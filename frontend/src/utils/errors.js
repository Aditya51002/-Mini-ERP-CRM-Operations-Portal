export function getApiErrorMessage(error) {
  const responseError = error.response?.data?.error;

  if (responseError?.details?.insufficientProducts?.length) {
    const products = responseError.details.insufficientProducts
      .map((product) => {
        const label = product.sku
          ? `${product.productName || "Product"} (${product.sku})`
          : `Product ${product.productId}`;
        return `${label}: requested ${product.requestedQuantity}, available ${product.availableQuantity}`;
      })
      .join("; ");

    return `${responseError.message}: ${products}`;
  }

  if (responseError?.message) {
    return responseError.message;
  }

  if (error.message === "Network Error") {
    return "Could not reach the backend. Check that the API server is running.";
  }

  return error.message || "Something went wrong";
}
