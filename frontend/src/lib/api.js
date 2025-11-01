export const uploadCSV = async (rosterFile, activitiesFile, skillFile, minScale, maxScale) => {
  const formData = new FormData();

  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  formData.append("roster", rosterFile);
  formData.append("activities", activitiesFile);
  formData.append("skills", skillFile);
  if (minScale !== undefined && maxScale !== undefined) {
    formData.append("min_points_scale", String(minScale));
    formData.append("max_points_scale", String(maxScale));
  }

  const res = await fetch(`${API_BASE_URL}/api/upload-csv`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload CSVs");

  return res.json();
};
