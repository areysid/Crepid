export const uploadCSV = async (rosterFile, activitiesFile, skillFile, minScale, maxScale) => {
  const formData = new FormData();
  formData.append("roster", rosterFile);
  formData.append("activities", activitiesFile);
  formData.append("skills", skillFile);
  if (minScale !== undefined && maxScale !== undefined) {
    formData.append("min_points_scale", String(minScale));
    formData.append("max_points_scale", String(maxScale));
  }

  const res = await fetch("http://localhost:8000/api/upload-csv", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload CSVs");

  return res.json();
};
