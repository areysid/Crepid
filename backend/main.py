# backend/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from crepid_model import (
    load_data,
    compute_metrics,
    suggest_rebalance,
    suggest_training,
    hiring_decision,
    risk_flags,
    suggest_appraisal,   # <-- newly added import
)
import tempfile

app = FastAPI()

# Allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict to your frontend in production
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

@app.post("/api/upload-csv")
async def upload_csv(
    roster: UploadFile = File(...),
    activities: UploadFile = File(...),
    skills: UploadFile = File(...)
):
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

    # Compute metrics
    model = load_data(roster_path, activities_path, skills_path, settings)
    compute_metrics(model)

    # rebalance = suggest_rebalance(model, settings)
    rebalance = suggest_rebalance(model)
    training = suggest_training(model)
    hiring = hiring_decision(model)
    risks = risk_flags(model)
    appraisal = suggest_appraisal(model)   # <-- new function call

    # Return everything as JSON
    return {
        "activities_with_metrics": model.activities.to_dict(orient="records"),
        "rebalance": rebalance,
        "training": training.to_dict(orient="records"),
        "hiring": hiring,
        "risks": risks.to_dict(orient="records"),
        "appraisal": appraisal.to_dict(orient="records"),   # <-- include in response
    }