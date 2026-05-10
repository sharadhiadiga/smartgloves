const axios = require('axios');

const DEFAULT_ML_FALLBACK = {
  level: 'Unknown',
  status: 'Unknown',
  stress: 0,
  issues: ['Prediction service unavailable'],
  measures: ['Verify ML API is running and reachable from backend'],
  recommendation: 'ML unavailable',
};

const predictHealth = async (data) => {
  console.log('ML REQUEST:', data);

  const required = ['temperature', 'heartRate', 'spo2', 'gsr'];
  const missingFields = required.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missingFields.length > 0) {
    console.error('ML Error: Invalid input data - missing fields:', missingFields);
    return {
      ...DEFAULT_ML_FALLBACK,
      issues: [`Missing ML input fields: ${missingFields.join(', ')}`],
    };
  }

  try {
    const response = await axios.post(
      process.env.ML_API_URL || 'http://localhost:5001/predict',
      data,
      { timeout: 5000 }
    );

    console.log('ML Response status:', response.status);
    console.log('ML Response data:', response.data);

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid ML response payload');
    }

    return response.data;
  } catch (error) {
    console.error('ML Error:', error?.message || error);
    return DEFAULT_ML_FALLBACK;
  }
};

module.exports = { predictHealth };