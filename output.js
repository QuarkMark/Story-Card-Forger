const modifier = (text) => {
    const result = TemplateFactory.onOutput(text, storyCards, state);
    return { text: result.text, stop: false };
};
modifier(text);