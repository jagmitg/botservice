// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, InputHints } = require("botbuilder");
const { LuisRecognizer } = require("botbuilder-ai");
const {
    ComponentDialog,
    DialogSet,
    DialogTurnStatus,
    TextPrompt,
    WaterfallDialog
} = require("botbuilder-dialogs");

const MAIN_WATERFALL_DIALOG = "mainWaterfallDialog";

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, paymentDialog, renewDialog) {
        super("MainDialog");

        if (!luisRecognizer) throw new Error("[MainDialog]: Missing parameter 'luisRecognizer' is required");
        this.luisRecognizer = luisRecognizer;

        if (!paymentDialog) throw new Error("[MainDialog]: Missing parameter 'paymentDialog' is required");
        if (!renewDialog) throw new Error("[MainDialog]: Missing parameter 'renewDialog' is required");

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt("TextPrompt"))
            .addDialog(paymentDialog)
            .addDialog(renewDialog)
            .addDialog(
                new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                    this.introStep.bind(this),
                    this.actStep.bind(this)
                ])
            );

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async introStep(stepContext) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText =
                "NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.";
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = stepContext.options.restartMsg
            ? stepContext.options.restartMsg
            : "Hi [username], I’m SIPPI the TVL chatbot. 🙂 \n \n I’m here to answer your questions about the Simple Payment Plan.";
        const promptMessage = MessageFactory.suggestedActions(
            ["Make a Payment", "Renew my TV licence", "Update my name, address or bank details"],
            messageText,
            InputHints.ExpectingInput
        );
        return await stepContext.prompt("TextPrompt", { prompt: promptMessage });
    }

    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the paymentDialog child dialog to collect any remaining details.
     */
    async actStep(stepContext) {
        const bookingDetails = {};

        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the paymentDialog path.
            return await stepContext.beginDialog("paymentDialog", bookingDetails);
        }

        // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
            case "MakeAPayment": {
                return await stepContext.beginDialog("paymentDialog");
            }

            case "RenewMyTvLicense": {
                console.log("testing");
                return await stepContext.beginDialog("renewDialog");
            }

            default: {
                // Catch all for unhandled intents
                const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${LuisRecognizer.topIntent(
                    luisResult
                )})`;
                await stepContext.context.sendActivity(
                    didntUnderstandMessageText,
                    didntUnderstandMessageText,
                    InputHints.IgnoringInput
                );
            }
        }

        return await stepContext.next();
    }
}

module.exports.MainDialog = MainDialog;
