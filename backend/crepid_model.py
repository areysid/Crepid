from dataclasses import dataclass
import pandas as pd
from datetime import datetime

# ------------------------------
# Data container for the model
# ------------------------------
@dataclass
class Model:
    roster: pd.DataFrame
    activities: pd.DataFrame
    skills: pd.DataFrame
    settings: dict

# ------------------------------
# Load + validate data
# ------------------------------
def load_data(roster_csv: str, activities_csv: str, skills_csv: str, settings: dict) -> Model:
    # Load CSVs into pandas
    roster = pd.read_csv(roster_csv)
    activities = pd.read_csv(activities_csv)
    skills = pd.read_csv(skills_csv)

    # --- Validation checks ---

    # 1. EmpIDs in activities must exist in roster
    missing_ids = set(activities["EmpID"]) - set(roster["EmpID"])
    if missing_ids:
        raise ValueError(f"Invalid EmpIDs in activities.csv: {missing_ids}")

    # 2. Value ranges for TimeFreq, Importance, Points
    if not activities["TimeFreq"].between(0, 7).all():
        raise ValueError("TimeFreq values must be between 0 and 7")
    if not activities["Importance"].between(0, 7).all():
        raise ValueError("Importance values must be between 0 and 7")
    if not activities["Points"].between(0, 2).all():
        raise ValueError("Points values must be between 0 and 2")

    # 3. Each employee must have 7–10 activities
    activity_counts = activities.groupby("EmpID").size()
    bad_counts = activity_counts[(activity_counts < 7) | (activity_counts > 10)]
    if not bad_counts.empty:
        raise ValueError(
            f"Each employee must have 7–10 activities. Offenders: {bad_counts.to_dict()}"
        )

    # 4. Salary must be numeric and positive
    if (roster["SalaryINR"] <= 0).any():
        raise ValueError("All salaries must be positive numbers")

    # ✅ Return validated model
    return Model(
        roster=roster,
        activities=activities,
        skills=skills,
        settings=settings,
    )





def compute_metrics(model: Model) -> None:
    """
    Compute TIm, RelWeight, DollarValue, NetValue per activity
    and EmpTotalTI, WPI per employee.
    The results are stored in the model.activities DataFrame.
    """

    # Merge employee salary into activities
    activities = model.activities.copy()
    roster = model.roster.copy()
    activities = activities.merge(
        roster[["EmpID", "SalaryINR"]], on="EmpID", how="left"
    )

    # Compute TIm
    activities["TIm"] = activities["TimeFreq"] * activities["Importance"]

    # Compute RelWeight per employee
    activities["RelWeight"] = activities.groupby("EmpID")["TIm"].transform(
        lambda x: x / x.sum() if x.sum() > 0 else 0
    )

    # Compute DollarValue
    activities["DollarValue"] = activities["RelWeight"] * activities["SalaryINR"]

    # Compute NetValue
    activities["NetValue"] = activities["DollarValue"] * activities["Points"]

    # Compute EmpTotalTI per employee
    emp_total_ti = activities.groupby("EmpID")["TIm"].sum().to_dict()
    activities["EmpTotalTI"] = activities["EmpID"].map(emp_total_ti)

    # --- Updated WPI calculation to avoid FutureWarning ---
    emp_wpi = {}
    for emp_id, df in activities.groupby("EmpID", sort=False):
        total_dollar = df["DollarValue"].sum()
        total_net = df["NetValue"].sum()
        emp_wpi[emp_id] = total_net / total_dollar if total_dollar > 0 else 0

    activities["WPI"] = activities["EmpID"].map(emp_wpi)

    # Save back to model
    model.activities = activities
    print("✅ Metrics computed successfully!")





# def suggest_rebalance(model: Model, settings: dict) -> list:
#     """
#     Suggest workload rebalancing proposals.
#     Returns a list of dicts: fromEmp, toEmp, Activity, DeltaTIm
#     """
#     activities = model.activities.copy()
#     proposals = []

#     min_ti = settings["WorkloadMinTI"]
#     max_ti = settings["WorkloadMaxTI"]

#     # Current workload per employee
#     emp_total_ti = activities.groupby("EmpID")["TIm"].sum().to_dict()

#     # Process each activity
#     for activity, df_act in activities.groupby("Activity"):
#         # Donors: Points < 1.0 and Importance >= 4
#         donors = df_act[(df_act["Points"] < 1.0) & (df_act["Importance"] >= 4)].copy()
#         donors = donors.sort_values("Points")

#         # Takers: Points >= 1.2
#         takers = df_act[df_act["Points"] >= 1.2].copy()
#         takers = takers.sort_values("Points", ascending=False)

#         # Greedy transfer
#         for _, donor in donors.iterrows():
#             for _, taker in takers.iterrows():
#                 from_emp = donor["EmpID"]
#                 to_emp = taker["EmpID"]

#                 # Max delta based on donor, taker, and settings
#                 donor_ti = donor["TIm"]
#                 taker_ti = emp_total_ti[to_emp]
#                 max_transfer = min(10, donor_ti - 5, max_ti - taker_ti)
#                 if max_transfer <= 0:
#                     continue

#                 # Record proposal
#                 proposals.append({
#                     "fromEmp": from_emp,
#                     "toEmp": to_emp,
#                     "Activity": activity,
#                     "DeltaTIm": max_transfer
#                 })

#                 # Update totals for next iteration
#                 emp_total_ti[from_emp] -= max_transfer
#                 emp_total_ti[to_emp] += max_transfer
#                 donor_ti -= max_transfer

#     return proposals

def suggest_rebalance(model: Model) -> list:
    """
    Suggest rebalance of Frequency and Importance for activities,
    redistributing based on employee Points while preserving
    original activity totals (bucket logic).
    
    Returns a list of dicts suitable for JSON output (table format).
    """

    activities = model.activities.copy()
    rebalance_rows = []

    for activity, group in activities.groupby("Activity"):
        total_freq = group["TimeFreq"].sum()
        total_imp = group["Importance"].sum()

        # Weighting factor = Points
        total_points = group["Points"].sum()

        for _, row in group.iterrows():
            if total_points > 0:
                freq_share = (row["Points"] / total_points) * total_freq
                imp_share = (row["Points"] / total_points) * total_imp
            else:
                # fallback: split evenly if no one has points
                freq_share = total_freq / len(group)
                imp_share = total_imp / len(group)

            # Calculate deltas
            delta_freq = round(freq_share - row["TimeFreq"], 2)
            delta_imp = round(imp_share - row["Importance"], 2)

            # Human-readable suggestion
            suggestions = []
            if delta_freq > 0:
                suggestions.append(f"Increase Frequency by {delta_freq}")
            elif delta_freq < 0:
                suggestions.append(f"Decrease Frequency by {abs(delta_freq)}")

            if delta_imp > 0:
                suggestions.append(f"Increase Importance by {delta_imp}")
            elif delta_imp < 0:
                suggestions.append(f"Decrease Importance by {abs(delta_imp)}")

            suggestion_text = "; ".join(suggestions) if suggestions else "No change"

            rebalance_rows.append({
                "EmpID": row["EmpID"],
                "Activity": activity,
                "Points": row["Points"],
                "OriginalFreq": row["TimeFreq"],
                "AssignedFreq": round(freq_share, 2),
                "DeltaFreq": delta_freq,
                "OriginalImp": row["Importance"],
                "AssignedImp": round(imp_share, 2),
                "DeltaImp": delta_imp,
                "Suggestion": suggestion_text
            })

    # Return as JSON-like list
    return rebalance_rows



def suggest_training(model: Model) -> pd.DataFrame:
    """
    Suggest training interventions for employees based on activity deficits.
    Matches activity keywords with skill_library and calculates ROI.
    """

    activities = model.activities.copy()
    skills = model.skills.copy()   # <-- this is your skill_library.csv
    settings = model.settings

    proposals = []

    for emp_id, emp_data in activities.groupby("EmpID"):
        emp_salary = emp_data["SalaryINR"].iloc[0]

        # Deficits: activities where Points < 2
        deficits = emp_data[emp_data["Points"] < 2]

        for _, deficit in deficits.iterrows():
            keyword = deficit["Activity"]  # assumes activity name aligns with skill_library["Keyword"]

            # Match with skill_library
            match = skills[skills["Keyword"].str.lower() == keyword.lower()]

            if not match.empty:
                row = match.iloc[0]

                # Use cheaper option between inhouse and external
                training_cost = min(
                    row["CostExternalPerPersonINR"],
                    row["CostInhousePerSessionINR"]
                )

                # Expected gain
                training_gain = deficit["DollarValue"] * row["ExpectedLift"]

                roi = (training_gain - training_cost) / training_cost if training_cost > 0 else 0

                proposals.append({
                    "EmpID": emp_id,
                    "Activity": deficit["Activity"],
                    "Program": row["Program"],
                    "SkillArea": row["SkillArea"],
                    "DeficitValue": round(deficit["DollarValue"], 2),
                    "TrainingCost": training_cost,
                    "ExpectedGain": round(training_gain, 2),
                    "ROI": round(roi, 2),
                    "Recommendation": "Train" if roi >= settings["TrainingROIMin"] else "Skip (Low ROI)"
                })

    proposals_df = pd.DataFrame(proposals)
    print("✅ Training suggestions generated from skill_library!")
    return proposals_df






import math

def hiring_decision(model: Model) -> dict:
    """
    Decide if new hires are needed based on workload and generate JD content.
    """

    activities = model.activities.copy()
    roster = model.roster.copy()
    settings = model.settings

    # --- Check overload conditions ---
    overloaded = activities.groupby("EmpID")["EmpTotalTI"].first() > settings["WorkloadMaxTI"]
    overloaded_count = overloaded.sum()

    team_avg_ti = activities["EmpTotalTI"].mean()

    hire_needed = overloaded_count >= 2 or team_avg_ti > settings["WorkloadMaxTI"]

    result = {
        "HireNeeded": False,
        "NewHires": 0,
        "JD_Activities": [],
        "HireTargetTI": settings["HireTargetTI"],
        "BudgetINR": 0,
    }

    if not hire_needed:
        print("✅ No new hires required.")
        return result

    # --- Capacity shortfall ---
    excess_ti = (activities.groupby("EmpID")["EmpTotalTI"].first() - 140).clip(lower=0).sum()
    new_hires = math.ceil(excess_ti / settings["HireTargetTI"])

    # --- JD Content ---
    team_ti_by_activity = activities.groupby("Activity")["TIm"].sum()
    avg_points_by_activity = activities.groupby("Activity")["Points"].mean()

    # Pick top 5 activities with high load & low quality
    jd_activities = (
        pd.DataFrame({
            "TIm": team_ti_by_activity,
            "AvgPoints": avg_points_by_activity
        })
        .sort_values(["TIm", "AvgPoints"], ascending=[False, True])
        .head(5)
        .index.tolist()
    )

    # --- Salary budget ---
    peer_median = roster["SalaryINR"].median()
    budget = round(peer_median * (settings["HireTargetTI"] / settings["IdealTI"]))

    result = {
        "HireNeeded": True,
        "NewHires": new_hires,
        "JD_Activities": jd_activities,
        "HireTargetTI": settings["HireTargetTI"],
        "BudgetINR": budget,
    }

    print(f"⚠️ Hiring required! Suggest {new_hires} new hires with budget ~₹{budget}")
    return result






# def risk_flags(model: Model) -> pd.DataFrame:
#     """
#     Evaluate employee performance risks (PIP / Separation) based on WPI, high-importance deficits, and training ROI.
#     """

#     activities = model.activities.copy()
#     roster = model.roster.copy()
#     settings = model.settings

#     risk_list = []

#     for emp_id, emp_data in activities.groupby("EmpID"):
#         salary = emp_data["SalaryINR"].iloc[0]
#         wpi = emp_data["WPI"].iloc[0]

#         # High importance deficits: Importance >= 4 and Points < 1.0
#         high_imp_deficits = emp_data[(emp_data["Importance"] >= 4) & (emp_data["Points"] < 1.0)]
#         high_imp_deficits_count = len(high_imp_deficits)

#         high_imp_gap_inr = (high_imp_deficits["DollarValue"] * (1 - high_imp_deficits["Points"])).sum()

#         # Max Training ROI (if available from suggest_training)
#         max_train_roi = 0.0
#         # Check if we computed training suggestions before
#         if hasattr(model, "training_suggestions"):
#             emp_train = model.training_suggestions[model.training_suggestions["EmpID"] == emp_id]
#             if not emp_train.empty:
#                 max_train_roi = emp_train["ROI"].max()

#         pip_flag = (
#             wpi < settings["PIP_WPI"]
#             and (high_imp_deficits_count >= settings["MinHighImpDeficits"] or high_imp_gap_inr >= salary * settings["HighImpGapPctOfSalary"])
#         )

#         sep_flag = (
#             wpi < settings["SEP_WPI"]
#             and (high_imp_deficits_count >= settings["MinHighImpDeficits"] or high_imp_gap_inr >= salary * settings["HighImpGapPctOfSalary"])
#             and max_train_roi < settings["TrainingROIMin"]
#         )

#         risk_list.append({
#             "EmpID": emp_id,
#             "Name": roster.loc[roster["EmpID"] == emp_id, "Name"].iloc[0],
#             "Role": roster.loc[roster["EmpID"] == emp_id, "Role"].iloc[0],
#             "WPI": round(wpi, 2),
#             "HighImpDeficits": high_imp_deficits_count,
#             "HighImpGapINR": round(high_imp_gap_inr, 2),
#             "PIP_Flag": pip_flag,
#             "Separation_Flag": sep_flag
#         })

#     risk_df = pd.DataFrame(risk_list)
#     print("🚨 Risk flags evaluated for all employees.")
#     return risk_df


def risk_flags(model: Model) -> pd.DataFrame:
    """
    Evaluate employee performance risks (PIP / Separation) based on WPI,
    critical deficits, per-deficit training ROI, and tenure.
    """
    activities = model.activities.copy()
    roster = model.roster.copy()
    settings = model.settings

    today = datetime.today()
    tenure_threshold_years = 3

    risk_list = []

    for emp_id, emp_data in activities.groupby("EmpID"):
        emp_roster = roster[roster["EmpID"] == emp_id].iloc[0]
        salary = emp_roster["SalaryINR"]
        wpi = emp_data["WPI"].iloc[0]

        # Flexible parsing for DateOfJoining
        doj_str = emp_roster["DateOfJoining"]
        for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
            try:
                doj = datetime.strptime(doj_str, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Unknown date format for employee {emp_id}: {doj_str}")

        tenure_years = (today - doj).days / 365.25

        # Critical deficits: Importance >= 4 and Points < 1.0
        critical_deficits = emp_data[(emp_data["Importance"] >= 4) & (emp_data["Points"] < 1.0)]
        critical_count = len(critical_deficits)
        critical_gap_inr = (critical_deficits["DollarValue"] * (1 - critical_deficits["Points"])).sum()

        # Training suggestions for this employee
        emp_train = None
        if hasattr(model, "training_suggestions"):
            emp_train = model.training_suggestions[model.training_suggestions["EmpID"] == emp_id]

        # --- Decision Logic ---
        pip_flag = "No"
        sep_flag = "No"
        remark = "No issues"

        # Check per-deficit ROI: merge critical deficits with training suggestions
        critical_low_roi = False
        if emp_train is not None and not emp_train.empty and critical_count > 0:
            merged = critical_deficits.merge(
                emp_train[['Activity', 'ROI']], on='Activity', how='left'
            )
            # Any deficit with ROI < TrainingROIMin triggers separation
            critical_low_roi = (merged['ROI'] < settings["TrainingROIMin"]).any()

        if critical_low_roi:
            # Any critical deficit has low ROI → separation
            sep_flag = "Yes"
            remark = "High-impact deficits, low ROI → should be fired"
        elif critical_count > 0:
            # PIP/training recommended
            pip_flag = "Yes"
            remark = "High-impact deficits → needs training"
        else:
            remark = "No issues"

        risk_list.append({
            "EmpID": emp_id,
            "Name": emp_roster["Name"],
            "Role": emp_roster["Role"],
            "WPI": round(wpi, 2),
            "HighImpDeficits": critical_count,
            "HighImpGapINR": round(critical_gap_inr, 2),
            "PIP_Flag": pip_flag,
            "Separation_Flag": sep_flag,
            "Remark": remark
        })

    risk_df = pd.DataFrame(risk_list)
    print("🚨 Risk flags evaluated for all employees with per-deficit ROI logic.")
    return risk_df



def suggest_appraisal(model: Model) -> pd.DataFrame:
    """
    Suggests appraisal actions based on WPI and Years Worked.
    Uses roster + activities inside the model.
    
    Conditions:
    - WPI < 0.9 → Risk Flag
    - 0.9 ≤ WPI ≤ 1.1 → Normal Increment
    - WPI > 1.1 → Incentive
    - WPI > 1.2 AND YearsWorked > 2 → Promotion / Incentive
    """
    activities = model.activities.copy()
    roster = model.roster.copy()

    today = datetime.today()
    results = []

    for emp_id, emp_data in activities.groupby("EmpID"):
        emp_roster = roster[roster["EmpID"] == emp_id].iloc[0]
        wpi = emp_data["WPI"].iloc[0]

        # --- Calculate tenure (YearsWorked) ---
        doj_str = emp_roster["DateOfJoining"]
        for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
            try:
                doj = datetime.strptime(doj_str, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Unknown date format for employee {emp_id}: {doj_str}")

        years = (today - doj).days / 365.25

        # --- Decision logic ---
        if wpi < 0.9:
            suggestion = "Risk Flag (Needs Review)"
        elif 0.9 <= wpi <= 1.1:
            suggestion = "Normal Increment (~5%)"
        elif wpi > 1.2 and years > 2:
            suggestion = "Promotion / Incentive"
        elif wpi > 1.1:
            suggestion = "Incentive"
        else:
            suggestion = "No Change"

        results.append({
            "EmpID": emp_id,
            "Name": emp_roster["Name"],
            "Role": emp_roster["Role"],
            "WPI": round(wpi, 2),
            "YearsWorked": round(years, 1),
            "AppraisalSuggestion": suggestion
        })

    df = pd.DataFrame(results)
    print("✅ Appraisal suggestions generated!")
    return df