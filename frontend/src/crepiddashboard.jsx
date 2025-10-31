"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import FAQSection from "@/components/FAQSection";

export default function CrepidDashboard() {
  const [rosterFile, setRosterFile] = useState(null);
  const [activitiesFile, setActivitiesFile] = useState(null);
  const [skillsFile, setSkillsFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // Scale state — default values set
  const [minScale, setMinScale] = useState("0");
  const [maxScale, setMaxScale] = useState("2");

  // Currency state
  const [currency, setCurrency] = useState("INR");
  const usdRate = 83; // Example rate

  const handleUpload = async () => {
    if (!rosterFile || !activitiesFile || !skillsFile) {
      alert("Please select all three files!");
      return;
    }

    if (minScale === "" || maxScale === "") {
      console.log("No custom points scale provided. The system will auto-detect min/max from CSV.");
    }

    // Parse scales
    const min = minScale === "" ? undefined : parseFloat(minScale);
    const max = maxScale === "" ? undefined : parseFloat(maxScale);

    // Validate scales
    if ((min !== undefined && isNaN(min)) || (max !== undefined && isNaN(max))) {
      alert("Min or Max scale is invalid");
      return;
    }
    if (min !== undefined && max !== undefined && min >= max) {
      alert("Min scale must be less than Max scale");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("roster", rosterFile);
    formData.append("activities", activitiesFile);
    formData.append("skills", skillsFile);

    if (min !== undefined && max !== undefined) {
      formData.append("min_points_scale", String(min));
      formData.append("max_points_scale", String(max));
    }

    try {
      const res = await fetch("http://localhost:8000/api/upload-csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let msg = `Server responded with status ${res.status}`;
        try {
          const err = await res.json();
          msg = err?.detail?.message || err?.detail || msg;
          if (err?.detail?.violations_count) {
            console.error("Scale violations sample:", err.detail.violations_sample);
          }
        } catch {}
        throw new Error(msg);
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Upload failed:", err);
      alert(String(err.message || err));
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    if (amount == null) return "";

    if (currency === "USD") {
      const converted = amount / usdRate;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(converted);
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleApplyRebalance = async () => {
    if (!data?.rebalance || data.rebalance.length === 0)
      return alert("No rebalance suggestions available!");
    try {
      const res = await fetch("http://localhost:8000/api/apply-rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebalance_rows: data.rebalance, custom_changes: false }),
      });
      if (!res.ok) throw new Error("Failed to apply rebalance");
      const updated = await res.json();
      setData({
        ...data,
        activities_with_metrics: updated.activities_with_metrics,
        rebalance: updated.rebalance,
      });
    } catch (err) {
      console.error(err);
      alert("Error applying rebalance. Check console.");
    }
  };

  const handleRevertActivities = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/revert-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to revert activities");
      const updated = await res.json();
      setData({
        ...data,
        activities_with_metrics: updated.activities_with_metrics,
        rebalance: updated.rebalance,
      });
    } catch (err) {
      console.error(err);
      alert("Error reverting activities. Check console.");
    }
  };

  // Download template functions
  const downloadTemplate = (templateType) => {
    let csvContent = "";
    let filename = "";

    if (templateType === "roster") {
      csvContent = `EmpID,Name,Role,Domain,SalaryINR,DateOfJoining
1,Alice,Dev,Backend,800000,09/09/2021
2,Bob,Dev,Backend,750000,01/04/2022
3,Charlie,QA,Testing,600000,15/07/2023`;
      filename = "roster_template.csv";
    } else if (templateType === "activities") {
      csvContent = `EmpID,Activity,TimeFreq,Importance,Points
1,Reporting,5,7,1.5
1,Client Calls,6,6,2.0
1,Documentation,4,5,1.5
1,Training,5,6,2.0
1,Code Review,6,7,0.5
1,Team Meeting,5,4,1.0
1,Quality Check,4,5,1.5
2,Reporting,2,6,2.0
2,Client Calls,3,5,2.0
2,Documentation,3,3,1.5
2,Training,4,4,0.5
2,Code Review,5,6,1.5
2,Team Meeting,3,4,1.0
2,Quality Check,2,5,2.0`;
      filename = "activities_template.csv";
    } else if (templateType === "skills") {
      csvContent = `Keyword,SkillArea,Program,Hours,CostExternalPerPersonINR,CostInhousePerSessionINR,ExpectedLift,Notes
Code Review,Software,CR Program,4,5000,3000,0.5,Improve code quality
Unit Testing,Software,UT Program,3,4000,2500,0.4,Improve test coverage
Documentation,Software,DOC Program,2,3000,2000,0.3,Improve documentation quality
Team Management,Management,TM Program,8,15000,8000,0.6,Enhance leadership skills
Client Communication,Sales,CC Program,4,6000,3500,0.5,Improve client interaction`;
      filename = "skill_library_template.csv";
    }

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl shadow-lg"
      >
        <h2 className="text-xl font-bold mb-4">Upload CSV Files</h2>

        {/* Download Templates Section */}
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium mb-2 text-blue-800">
            Need templates? Download sample files with correct format:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("roster")} className="text-xs">
              <Download className="h-3 w-3 mr-1" />
              Download Roster Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("activities")} className="text-xs">
              <Download className="h-3 w-3 mr-1" />
              Download Activities Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate("skills")} className="text-xs">
              <Download className="h-3 w-3 mr-1" />
              Download Skills Template
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* File Inputs */}
          <div className="flex flex-col">
            <span className="text-sm font-medium mb-1">Roster CSV</span>
            <Input type="file" accept=".csv" onChange={(e) => setRosterFile(e.target.files[0])} />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium mb-1">Activities CSV</span>
            <Input type="file" accept=".csv" onChange={(e) => setActivitiesFile(e.target.files[0])} />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium mb-1">Skills CSV</span>
            <Input type="file" accept=".csv" onChange={(e) => setSkillsFile(e.target.files[0])} />
          </div>

          {/* Custom Points Scale */}
          <div className="flex flex-col">
            <span className="text-sm font-medium mb-1">Points Scale Min</span>
            <Input
              type="number"
              step="0.1"
              value={minScale}
              onChange={(e) => setMinScale(e.target.value)}
            />
            <span className="text-xs text-muted-foreground mt-1">
              Default scale is 0–2. Change if using a custom scale.
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium mb-1">Points Scale Max</span>
            <Input
              type="number"
              step="0.1"
              value={maxScale}
              onChange={(e) => setMaxScale(e.target.value)}
            />
            <span className="text-xs text-muted-foreground mt-1">
              Default scale is 0–2. Change if using a custom scale.
            </span>
          </div>

          <Button onClick={handleUpload} disabled={loading}>
            {loading ? "Uploading..." : "Upload & Compute"}
          </Button>
        </div>
      </motion.div>

      {/* Data Display */}
      {data && (
        <>
          <div className="flex gap-4 mb-4 justify-end">
            <Button variant="default" onClick={handleApplyRebalance}>
              Apply Rebalance
            </Button>
            <Button variant="outline" onClick={handleRevertActivities}>
              Revert Activities
            </Button>
          </div>

          <div className="flex justify-end mb-2">
            <Button variant="outline" onClick={() => setCurrency(currency === "INR" ? "USD" : "INR")}>
              Switch to {currency === "INR" ? "USD" : "INR"}
            </Button>
          </div>

          <motion.div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <DataCard title="Metrics Count" value={data.activities_with_metrics?.length || 0} color="primary" />
            <DataCard title="Rebalance Suggestions" value={data.rebalance?.length || 0} color="primary" />
            <DataCard title="Training Recommendations" value={data.training?.length || 0} color="primary" />
            <DataCard title="New Hires" value={data.hiring?.NewHires || 0} color="primary" />
          </motion.div>

          <motion.div className="space-y-6">
            <SectionTable title="Activities with Metrics" items={data.activities_with_metrics} formatCurrency={formatCurrency} />
            <SectionTable title="Rebalance Suggestions" items={data.rebalance} formatCurrency={formatCurrency} />
            <SectionTable title="Training Recommendations" items={data.training} formatCurrency={formatCurrency} />
            <SectionTable title="Appraisal Suggestions" items={data.appraisal} />
            <SectionTable title="Risk Flags" items={data.risks} />
          </motion.div>

          <div className="flex justify-end mb-0">
            <Button variant="default" onClick={() => window.open("/CREPIDSystemManual.pdf", "_blank")}>
              View Full Manual
            </Button>
          </div>

          <FAQSection
            faqs={[
              {
                question: "What does TIm mean?",
                answer: "TIm (Task Importance Metric) is calculated as TimeFreq × Importance for each activity.",
              },
              {
                question: "What is WPI?",
                answer: "WPI (Weighted Performance Index) is the ratio of NetValue to DollarValue, measuring efficiency of employee output.",
              },
              {
                question: "How are rebalancing suggestions made?",
                answer: "Activities with high importance but low quality are suggested to be transferred to employees with better skill points.",
              },
              {
                question: "When do hiring recommendations appear?",
                answer: "If workload exceeds the defined threshold (e.g., 140 TI), the system suggests new hires and estimates a budget.",
              },
              {
                question: "How is ROI in training calculated?",
                answer: "ROI = (Expected Gain – Training Cost) ÷ Training Cost, using lift percentages from the skill library.",
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

// ------------------------------
// Components
// ------------------------------

const DataCard = ({ title, value, color }) => (
  <Card className={`bg-gradient-to-br from-${color}/10 to-${color}/5 border-${color}/20`}>
    <CardContent className="text-center">
      <div className={`text-2xl font-bold text-${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{title}</div>
    </CardContent>
  </Card>
);

// Hide Columns per Section
const getColumnsToHide = (title, allColumns) => {
  const hideMap = {
    "Activities with Metrics": allColumns.filter(
      (col) =>
        col.includes("RelWeight") ||
        col.includes("EmpTotalTI") ||
        col.includes("SalaryINR") ||
        col.includes("PointsRaw") ||
        col.includes("NormalizedPoints")
    ),
    "Rebalance Suggestions": allColumns.filter(
      (col) =>
        col.includes("OriginalFreq") ||
        col.includes("AssignedFreq") ||
        col.includes("OriginalImp") ||
        col.includes("AssignedImp") ||
        col.includes("DeltaFreq") ||
        col.includes("DeltaImp") ||
        col.includes("CurrentCostINR") ||
        col.includes("AssignedCostINR") ||
        col.includes("CurrentProfitINR") ||
        col.includes("AssignedProfitINR")
    ),
    "Training Recommendations": allColumns.filter(
      (col) => col.includes("SkillArea") || col.includes("DeficitValue") || col.includes("Hours")
    ),
    "Risk Flags": allColumns.filter((col) => col.includes("EmpID") || col.includes("HighImpGapINR")),
  };
  return hideMap[title] || [];
};

// Section Table
const SectionTable = ({ title, items, formatCurrency }) => {
  if (!items || items.length === 0) return null;

  const allColumns = Object.keys(items[0]);
  const columns = allColumns.filter((col) => !getColumnsToHide(title, allColumns).includes(col));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 border text-left text-sm font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                {columns.map((col) => {
                  let value = item[col];

                  // Round numeric values to 2 decimals
                  if (typeof value === "number") {
                    value = Number(value.toFixed(2));
                  }

                  let cellStyle = {};

                  if (
                    formatCurrency &&
                    (col.toLowerCase().includes("cost") ||
                      col.toLowerCase().includes("gain") ||
                      col.toLowerCase().includes("value") ||
                      col.toLowerCase().includes("salary"))
                  ) {
                    value = value ? formatCurrency(value) : value;
                  }

                  if (col.toLowerCase() === "roi") {
                    if (value <= 7) cellStyle.backgroundColor = "#F87171";
                    else if (value <= 14) cellStyle.backgroundColor = "#FBBF24";
                    else cellStyle.backgroundColor = "#34D399";
                    cellStyle.color = "#000";
                  }

                  if (col.toLowerCase() === "wpi") {
                    if (value < 0.9) cellStyle.backgroundColor = "#FCA5A5";
                    else if (value > 1.1) cellStyle.backgroundColor = "#86EFAC";
                  }

                  if (col.includes("Flag") || col === "Recommendation" || col === "AppraisalSuggestion") {
                    const flagValue = String(value).toLowerCase();
                    if (
                      flagValue.includes("yes") ||
                      flagValue.includes("separat") ||
                      flagValue.includes("risk") ||
                      flagValue.includes("pip")
                    ) {
                      cellStyle.color = "#DC2626";
                      cellStyle.fontWeight = "600";
                    }
                  }

                  return (
                    <td key={col} className="px-4 py-2 border text-sm" style={cellStyle}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* DeltaProfitINR Total Row */}
            {title === "Rebalance Suggestions" &&
              items.some((i) => i.DeltaProfitINR != null) && (
                <tr className="bg-gray-200 font-semibold">
                  <td colSpan={columns.length - 1} className="px-4 py-2 text-right border">
                    Total DeltaProfitINR
                  </td>
                  <td className="px-4 py-2 border">
                    {formatCurrency &&
                      formatCurrency(
                        items.reduce((sum, i) => sum + (i.DeltaProfitINR || 0), 0)
                      )}
                  </td>
                </tr>
              )}
          </tbody>
        </table>

        {/* Download button under "Activities with Metrics" */}
        {title === "Activities with Metrics" && (
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                const csvRows = [
                  Object.keys(items[0]).join(","),
                  ...items.map((row) => Object.values(row).join(",")),
                ];
                const blob = new Blob([csvRows.join("\n")], {
                  type: "text/csv;charset=utf-8;",
                });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "activities_with_metrics.csv");
                link.click();
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Download CSV
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
