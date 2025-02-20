exports.handler = async function (context, event, callback) {
  let client = context.getTwilioClient();

  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  try {
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 100 });
    response.setStatusCode(200);
    response.setBody(phoneNumbers);
    // console.log(phoneNumbers);
  } catch (error) {
    response.setStatusCode(500);
    response.setBody(error);
    // console.log(error);
  }
  return callback(null, response);
};
