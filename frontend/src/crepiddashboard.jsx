"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
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

  // Currency state
  const [currency, setCurrency] = useState("INR");
  const usdRate = 83; // Example rate

  const handleUpload = async () => {
    if (!rosterFile || !activitiesFile || !skillsFile) {
      alert("Please select all three files!");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("roster", rosterFile);
    formData.append("activities", activitiesFile);
    formData.append("skills", skillsFile);

    try {
      const res = await fetch("http://localhost:8000/api/upload-csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed! Check console for details.");
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

    // Default INR
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
        <div className="flex flex-col md:flex-row gap-4 items-end">
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

          <Button onClick={handleUpload} disabled={loading}>
            {loading ? "Uploading..." : "Upload & Compute"}
          </Button>
        </div>

      </motion.div>

      {data && (
        <>
          {/* Currency Toggle */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setCurrency(currency === "INR" ? "USD" : "INR")}
            >
              Switch to {currency === "INR" ? "USD" : "INR"}
            </Button>
          </div>

          {/* Summary Cards */}
          <motion.div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <DataCard title="Metrics Count" value={data.activities_with_metrics?.length || 0} color="primary" />
            <DataCard title="Rebalance Suggestions" value={data.rebalance?.length || 0} color="primary" />
            <DataCard title="Training Recommendations" value={data.training?.length || 0} color="primary" />
            <DataCard title="New Hires" value={data.hiring?.NewHires || 0} color="primary" />
          </motion.div>

          {/* Tables Section */}
          <motion.div className="space-y-6">
            <SectionTable title="Activities with Metrics" items={data.activities_with_metrics} formatCurrency={formatCurrency} />
            <SectionTable title="Rebalance Suggestions" items={data.rebalance} />
            <SectionTable title="Hiring" items={data.hiring?.employees} formatCurrency={formatCurrency} />
            <SectionTable title="Training Recommendations" items={data.training} formatCurrency={formatCurrency} />
            <SectionTable title="Appraisal Suggestions" items={data.appraisal} />
            <SectionTable title="Risk Flags" items={data.risks} />
          </motion.div>

          <div className="flex justify-end mb-0">
            <Button
              variant="default"
              onClick={() => window.open("/CREPIDSystemManual.pdf", "_blank")}
            >
              View Full Manual
            </Button>
          </div>

          {/* FAQs Section */}
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

// Data Card
const DataCard = ({ title, value, color }) => (
  <Card className={`bg-gradient-to-br from-${color}/10 to-${color}/5 border-${color}/20`}>
    <CardContent className="text-center">
      <div className={`text-2xl font-bold text-${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{title}</div>
    </CardContent>
  </Card>
);

// Section Table
const SectionTable = ({ title, items, formatCurrency }) => {
  if (!items || items.length === 0) return null;
  const columns = Object.keys(items[0]);

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
                <th key={col} className="px-4 py-2 border text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t">
                {columns.map((col) => {
                  let value = item[col];
                  let cellStyle = {};

                  // Format currency if needed
                  if (
                    formatCurrency &&
                    (col.toLowerCase().includes("cost") ||
                      col.toLowerCase().includes("gain") ||
                      col.toLowerCase().includes("value") ||
                      col.toLowerCase().includes("salary"))
                  ) {
                    value = value ? formatCurrency(value) : value;
                  }

                  // Conditional ROI background
                  if (col.toLowerCase() === "roi") {
                    if (value <= 7) cellStyle.backgroundColor = "#F87171"; // red-400
                    else if (value <= 14) cellStyle.backgroundColor = "#FBBF24"; // amber-400
                    else cellStyle.backgroundColor = "#34D399"; // green-400
                    cellStyle.color = "#000";
                  }

                  return (
                    <td key={col} className="px-4 py-2 border" style={cellStyle}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
