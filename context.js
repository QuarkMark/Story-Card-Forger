const modifier = (text) => {
    const result = TemplateFactory.onContext(text, storyCards, state);
    return { text: result.text, stop: false };
};
modifier(text);