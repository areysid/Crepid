from fastapi import FastAPI, UploadFile, File, Body, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from crepid_model import (
    load_data,
    compute_metrics,
    suggest_rebalance,
    suggest_training,
    hiring_decision,
    risk_flags,
    suggest_appraisal,
    snapshot_activities,
    revert_activities,
    apply_rebalance_suggestions,
)
import tempfile
import pandas as pd

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = {
    "WorkloadMinTI": 100,
    "WorkloadMaxTI": 150,
    "IdealTI": 125,
    "HireTargetTI": 135,
    "TrainingROIMin": 0.14,
    "InhouseMinLearners": 3,
    "PIP_WPI": 0.90,
    "SEP_WPI": 0.75,
    "MinHighImpDeficits": 3,
    "HighImpGapPctOfSalary": 0.20
}

current_model = None

# -----------------------------
# Helper: map any scale → 0–2
# -----------------------------
def map_scale_to_0_2(points_series: pd.Series, min_user: float, max_user: float) -> pd.Series:
    if max_user - min_user == 0:
        raise ValueError("Min and Max points cannot be equal")
    return ((points_series - min_user) / (max_user - min_user)) * 2

# -----------------------------
# Upload CSV & Compute Metrics
# -----------------------------
@app.post("/api/upload-csv")
async def upload_csv(
    roster: UploadFile = File(...),
    activities: UploadFile = File(...),
    skills: UploadFile = File(...),
    min_points_scale: float | None = Form(default=None),
    max_points_scale: float | None = Form(default=None),
):
    global current_model

    # Save uploaded files temporarily
    with tempfile.NamedTemporaryFile(delete=False) as tmp_roster:
        tmp_roster.write(await roster.read())
        roster_path = tmp_roster.name
    with tempfile.NamedTemporaryFile(delete=False) as tmp_activities:
        tmp_activities.write(await activities.read())
        activities_path = tmp_activities.name
    with tempfile.NamedTemporaryFile(delete=False) as tmp_skills:
        tmp_skills.write(await skills.read())
        skills_path = tmp_skills.name

    # Load model
    model = load_data(roster_path, activities_path, skills_path, settings)

    # Determine min/max to use
    raw_points = model.activities["Points"]
    min_user = min_points_scale if min_points_scale is not None else raw_points.min()
    max_user = max_points_scale if max_points_scale is not None else raw_points.max()

    # Validate user scale if provided
    if min_points_scale is not None and max_points_scale is not None:
        too_low = raw_points < min_user
        too_high = raw_points > max_user
        if too_low.any() or too_high.any():
            bad_rows = model.activities.loc[too_low | too_high, ["EmpID", "Activity", "Points"]]
            sample = bad_rows.head(10).to_dict(orient="records")
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Points values are outside the provided scale.",
                    "min_points_scale": min_user,
                    "max_points_scale": max_user,
                    "violations_count": int(bad_rows.shape[0]),
                    "violations_sample": sample,
                },
            )

    # Apply normalization
    model.activities["NormalizedPoints"] = map_scale_to_0_2(raw_points, min_user, max_user)

    # Keep original points
    if "PointsRaw" not in model.activities.columns:
        model.activities["PointsRaw"] = raw_points

    model.min_points_scale = min_user
    model.max_points_scale = max_user

    # Compute metrics
    compute_metrics(model)
    snapshot_activities(model)
    current_model = model

    rebalance_rows = suggest_rebalance(model)
    rebalance_totals = getattr(model, "rebalance_totals", None)

    return {
        "activities_with_metrics": model.activities.to_dict(orient="records"),
        "rebalance": rebalance_rows,
        "rebalance_totals": rebalance_totals,
        "points_scale": {
            "min": min_user,
            "max": max_user,
            "using_normalized_points": True,
        },
        "points_preview": {
            "mean_raw": float(model.activities["PointsRaw"].mean()),
            "mean_normalized": float(model.activities["NormalizedPoints"].mean()),
        },
        "training": suggest_training(model).to_dict(orient="records"),
        "hiring": hiring_decision(model),
        "risks": risk_flags(model).to_dict(orient="records"),
        "appraisal": suggest_appraisal(model).to_dict(orient="records"),
    }

# -----------------------------
# Apply Rebalance
# -----------------------------
@app.post("/api/apply-rebalance")
async def apply_rebalance(rebalance_rows: list = Body(...), custom_changes: bool = Body(False)):
    global current_model
    if not current_model:
        raise HTTPException(status_code=400, detail="No model available. Upload CSV first.")
    apply_rebalance_suggestions(current_model, rebalance_rows, custom_changes)
    rebalance_rows = suggest_rebalance(current_model)
    rebalance_totals = getattr(current_model, "rebalance_totals", None)
    return {
        "activities_with_metrics": current_model.activities.to_dict(orient="records"),
        "rebalance": rebalance_rows,
        "rebalance_totals": rebalance_totals,
        "points_scale": {
            "min": getattr(current_model, "min_points_scale", None),
            "max": getattr(current_model, "max_points_scale", None),
            "using_normalized_points": "NormalizedPoints" in current_model.activities.columns,
        },
    }

# -----------------------------
# Revert Activities
# -----------------------------
@app.post("/api/revert-activities")
async def revert_to_original():
    global current_model
    if not current_model:
        raise HTTPException(status_code=400, detail="No model available. Upload CSV first.")
    revert_activities(current_model)
    compute_metrics(current_model)
    rebalance_rows = suggest_rebalance(current_model)
    rebalance_totals = getattr(current_model, "rebalance_totals", None)
    return {
        "activities_with_metrics": current_model.activities.to_dict(orient="records"),
        "rebalance": rebalance_rows,
        "rebalance_totals": rebalance_totals,
        "points_scale": {
            "min": getattr(current_model, "min_points_scale", None),
            "max": getattr(current_model, "max_points_scale", None),
            "using_normalized_points": "NormalizedPoints" in current_model.activities.columns,
        },
    }
