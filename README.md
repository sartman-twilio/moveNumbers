#How to get running moving numbers from parent to sub accounts
##Install Node
Download and install: here https://nodejs.org/en/download

##Install Twilio CLI
https://www.twilio.com/docs/twilio-cli/getting-started/install

##Add .env with
ACCOUNT_SID=<Your Account SID (Parent account)>
AUTH_TOKEN=<Your parent account Auth Token>

##Install dependencies
npm -i

##Create the profile to run locally
twilio profiles create <account sid>
Give it an easy name
twilio profiles use <easy name>

##Start the twilio serverless function
twilio serverless start

##Visit the server that was started /index.html
