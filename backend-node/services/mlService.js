const axios = require('axios');

const predictHealth = async (data) => {
  try {
    const response = await axios.post(
      process.env.ML_API_URL || "http://localhost:5001/predict",
      data,
      { timeout: 2000 }
    );

    return response.data.status;

  } catch (error) {
    console.error("ML Error:", error.message);
    return "Unknown";
  }
};

module.exports = { predictHealth };