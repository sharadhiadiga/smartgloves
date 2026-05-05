const axios = require('axios');

const predictHealth = async (data) => {
  try {
    const response = await axios.post(
      process.env.ML_API_URL || "http://localhost:5001/predict",
      data,
      { timeout: 2000 }
    );
    return response.data;

  } catch (error) {
    console.error("ML Error:", error.message);
    return {
      level: "Unknown",
      class: "Unknown",
      stress: 0,
      issues: ["Prediction service unavailable"],
      measures: ["Verify ML API is running and reachable from backend"],
    };
  }
};

module.exports = { predictHealth };