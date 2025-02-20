exports.handler = async function (context, event, callback) {
  let client = context.getTwilioClient();

  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  try {
    const subAccounts = await client.api.v2010.accounts.list({ limit: 100 });
    response.setStatusCode(200);
    response.setBody(subAccounts);
    // console.log(subAccounts);
  } catch (error) {
    response.setStatusCode(500);
    response.setBody(error);
    // console.log(error);
  }
  return callback(null, response);
};
