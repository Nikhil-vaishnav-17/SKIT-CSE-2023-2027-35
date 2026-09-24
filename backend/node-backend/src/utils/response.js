/**
 * Standardized API Response Helpers
 * 
 * Every API response from AttendAI backend follows this format:
 * 
 * Success: { success: true, message: "...", data: {...} }
 * Error:   { success: false, message: "...", error: "ERROR_CODE" }
 * 
 * This ensures the frontend always receives a predictable structure.
 */

/**
 * Send a success response.
 */
const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null }) => {
  const response = { success: true, message };
  if (data !== null) {
    response.data = data;
  }
  return res.status(statusCode).json(response);
};

/**
 * Send an error response.
 */
const sendError = (res, { statusCode = 500, message = 'Internal Server Error', error = 'INTERNAL_ERROR' }) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  });
};

module.exports = { sendSuccess, sendError };
