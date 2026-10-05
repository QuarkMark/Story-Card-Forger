const modifier = (text) => {
    const result = TemplateFactory.onInput(text, storyCards, state);
    return { text: result.text, stop: false };
};
modifier(text);