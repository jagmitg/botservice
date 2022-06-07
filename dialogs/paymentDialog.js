// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory, CardFactory } = require("botbuilder");
const { ComponentDialog, ConfirmPrompt, TextPrompt, WaterfallDialog } = require("botbuilder-dialogs");
const { DateResolverDialog } = require("./dateResolverDialog");
const { LuisRecognizer } = require("botbuilder-ai");
const PayByCash = require("../bots/resources/payByCash.json");
const DirectDebitPayment = require("../bots/resources/directDebitPayment.json");

const CONFIRM_PROMPT = "confirmPrompt";
const DATE_RESOLVER_DIALOG = "dateResolverDialog";
const TEXT_PROMPT = "textPrompt";
const WATERFALL_DIALOG = "waterfallDialog";

class PaymentDialog extends ComponentDialog {
    constructor(luisRecognizer, id) {
        super(id || "paymentDialog");

        if (!luisRecognizer) throw new Error("[MainDialog]: Missing parameter 'luisRecognizer' is required");
        this.luisRecognizer = luisRecognizer;

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new DateResolverDialog(DATE_RESOLVER_DIALOG))
            .addDialog(
                new WaterfallDialog(WATERFALL_DIALOG, [this.paymentStep.bind(this), this.actStep.bind(this)])
            );

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If a destination city has not been provided, prompt for one.
     */
    async paymentStep(stepContext) {
        const messageText = stepContext.options.restartMsg
            ? stepContext.options.restartMsg
            : "Ok, here are some of the ways that you can make a payment. \n \n Please type a question below, or select one of the following options:";
        const promptMessage = MessageFactory.suggestedActions(
            ["Debit Card", "SSP Payment Card", "Cash", "Mobile App"],
            messageText,
            InputHints.ExpectingInput
        );
        return await stepContext.prompt("TextPrompt", { prompt: promptMessage });
    }

    async actStep(stepContext) {
        // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
            case "CashPayment": {
                const payCash = CardFactory.adaptiveCard(PayByCash);
                await stepContext.context.sendActivity({ attachments: [payCash] });
                return await stepContext.endDialog();
            }

            case "DebitCardPayment": {
                const directDebitPayments = CardFactory.adaptiveCard(DirectDebitPayment);
                await stepContext.context.sendActivity({ attachments: [directDebitPayments] });
                return await stepContext.endDialog();
            }

            case "SSPPayment": {
                const messageText = stepContext.options.restartMsg
                    ? stepContext.options.restartMsg
                    : "debit card here";

                return await stepContext.prompt("TextPrompt", { prompt: messageText });
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

module.exports.PaymentDialog = PaymentDialog;
