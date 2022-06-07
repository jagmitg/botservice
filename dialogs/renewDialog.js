// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory } = require("botbuilder");
const {
    AttachmentPrompt,
    ChoiceFactory,
    ChoicePrompt,
    ComponentDialog,
    ConfirmPrompt,
    DialogSet,
    DialogTurnStatus,
    NumberPrompt,
    TextPrompt,
    WaterfallDialog
} = require("botbuilder-dialogs");
const { Channels } = require("botbuilder-core");
const { UserProfile } = require("../userProfile");

const ATTACHMENT_PROMPT = "ATTACHMENT_PROMPT";
const CHOICE_PROMPT = "CHOICE_PROMPT";
const CONFIRM_PROMPT = "CONFIRM_PROMPT";
const NAME_PROMPT = "NAME_PROMPT";
const NUMBER_PROMPT = "NUMBER_PROMPT";
const USER_PROFILE = "USER_PROFILE";
const WATERFALL_DIALOG = "WATERFALL_DIALOG";

class RenewDialog extends ComponentDialog {
    constructor(userState) {
        super("renewDialog");

        this.userProfile = userState.createProperty(USER_PROFILE);

        this.addDialog(new TextPrompt(NAME_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.agePromptValidator));

        this.addDialog(
            new WaterfallDialog(WATERFALL_DIALOG, [
                this.nameStep.bind(this),
                this.nameConfirmStep.bind(this),
                this.ageStep.bind(this),
                this.summaryStep.bind(this)
            ])
        );

        this.initialDialogId = WATERFALL_DIALOG;
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

    async nameStep(step) {
        step.values.transport = step.result.value;
        return await step.prompt(NAME_PROMPT, "Please enter your name.");
    }

    async nameConfirmStep(step) {
        step.values.name = step.result;

        // We can send messages to the user at any point in the WaterfallStep.
        await step.context.sendActivity(`Thanks ${step.result}.`);

        // WaterfallStep always finishes with the end of the Waterfall or with another dialog; here it is a Prompt Dialog.
        return await step.prompt(CONFIRM_PROMPT, "Do you want to give your age?", ["yes", "no"]);
    }

    async ageStep(step) {
        if (step.result) {
            // User said "yes" so we will be prompting for the age.
            // WaterfallStep always finishes with the end of the Waterfall or with another dialog; here it is a Prompt Dialog.
            const promptOptions = {
                prompt: "Please enter your age.",
                retryPrompt: "The value entered must be greater than 0 and less than 150."
            };

            return await step.prompt(NUMBER_PROMPT, promptOptions);
        } else {
            // User said "no" so we will skip the next step. Give -1 as the age.
            return await step.next(-1);
        }
    }

    async summaryStep(step) {
        if (step.result) {
            // Get the current profile object from user state.
            const userProfile = await this.userProfile.get(step.context, new UserProfile());

            userProfile.name = step.values.name;
            userProfile.age = step.values.age;

            let msg = `I have your mode of transport as ${userProfile.transport} and your name as ${userProfile.name}`;
            if (userProfile.age !== -1) {
                msg += ` and your age as ${userProfile.age}`;
            }

            msg += ".";
            await step.context.sendActivity(msg);
        } else {
            await step.context.sendActivity("Thanks. Your profile will not be kept.");
        }

        // WaterfallStep always finishes with the end of the Waterfall or with another dialog; here it is the end.
        return await step.endDialog();
    }

    async agePromptValidator(promptContext) {
        // This condition is our validation rule. You can also change the value at this point.
        return (
            promptContext.recognized.succeeded &&
            promptContext.recognized.value > 0 &&
            promptContext.recognized.value < 150
        );
    }
}

module.exports.RenewDialog = RenewDialog;
