/**
 * Validation logic for order payload
 */

/**
 * Validates the incoming order payload
 * @param {Object} data - Raw request payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateOrder(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Request body must be a valid JSON object"] };
  }

  // customerId validation
  if (!data.customerId || typeof data.customerId !== "string" || data.customerId.trim().length === 0) {
    errors.push("Field 'customerId' is required and must be a non-empty string");
  }

  // items validation
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push("Field 'items' is required and must contain at least one item");
  } else {
    data.items.forEach((item, index) => {
      const prefix = `Item at index ${index}`;
      if (!item || typeof item !== "object") {
        errors.push(`${prefix} must be an object`);
        return;
      }

      if (!item.productId || typeof item.productId !== "string" || item.productId.trim().length === 0) {
        errors.push(`${prefix}: 'productId' is required and must be a non-empty string`);
      }

      if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`${prefix}: 'quantity' must be a positive integer greater than 0`);
      }

      if (typeof item.price !== "number" || item.price < 0 || Number.isNaN(item.price)) {
        errors.push(`${prefix}: 'price' must be a valid non-negative number`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculates total order amount based on items
 * @param {Array<{ quantity: number, price: number }>} items 
 * @returns {number}
 */
function calculateTotal(items) {
  if (!Array.isArray(items)) {
    return 0;
  }

  const rawTotal = items.reduce((sum, item) => {
    const qty = typeof item.quantity === "number" ? item.quantity : 0;
    const price = typeof item.price === "number" ? item.price : 0;
    return sum + (qty * price);
  }, 0);

  // Round to 2 decimal places to avoid floating point issues
  return Math.round(rawTotal * 100) / 100;
}

module.exports = {
  validateOrder,
  calculateTotal
};
