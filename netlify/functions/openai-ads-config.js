exports.handler = async () => {
  const pixelId = process.env.OPENAI_ADS_PIXEL_ID || '';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      pixel_id: pixelId
    })
  };
};
