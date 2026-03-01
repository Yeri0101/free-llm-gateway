/**
 * puterClient.ts
 * Adapter that wraps the @heyputer/puter.js SDK for Node.js usage.
 * Converts OpenAI-compatible messages/options → puter.ai.chat() calls,
 * and maps the response back to the OpenAI chat completion format.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { init } = require('@heyputer/puter.js/src/init.cjs');

export interface PuterChatOptions {
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string;
}

/**
 * Calls puter.ai.chat() with the given auth token and returns an
 * OpenAI-compatible chat completion response object (non-streaming).
 */
export async function callPuterAI(
    authToken: string,
    messages: OpenAIMessage[],
    options: PuterChatOptions = {}
): Promise<any> {
    const puter = init(authToken);

    // Normalize messages: puter.ai.chat expects { role, content } objects.
    // Convert null content to empty string; drop unsupported roles gracefully.
    const normalizedMessages = messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content ?? '',
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
    }));

    const chatOptions: Record<string, any> = {};
    if (options.model) chatOptions.model = options.model;
    if (options.max_tokens) chatOptions.max_tokens = options.max_tokens;
    if (options.temperature !== undefined) chatOptions.temperature = options.temperature;

    const startTime = Date.now();

    // Non-streaming call
    const result = await puter.ai.chat(normalizedMessages, chatOptions);

    const latency = Date.now() - startTime;

    // Build an OpenAI-compatible response object
    // puter returns: { message: { content, role }, ... } or similar
    const messageContent =
        typeof result === 'string'
            ? result
            : result?.message?.content ?? result?.choices?.[0]?.message?.content ?? '';

    const usage = result?.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
    };

    return {
        id: `puter-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: options.model ?? 'puter-default',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: messageContent,
                },
                finish_reason: 'stop',
            },
        ],
        usage,
        _puter_latency_ms: latency,
    };
}

/**
 * Streaming version: returns an async generator that yields SSE-compatible
 * text chunks in the OpenAI stream format.
 */
export async function* callPuterAIStream(
    authToken: string,
    messages: OpenAIMessage[],
    options: PuterChatOptions = {}
): AsyncGenerator<string> {
    const puter = init(authToken);

    const normalizedMessages = messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content ?? '',
    }));

    const chatOptions: Record<string, any> = { stream: true };
    if (options.model) chatOptions.model = options.model;
    if (options.max_tokens) chatOptions.max_tokens = options.max_tokens;
    if (options.temperature !== undefined) chatOptions.temperature = options.temperature;

    const stream = await puter.ai.chat(normalizedMessages, chatOptions);

    const completionId = `puter-${Date.now()}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const model = options.model ?? 'puter-default';

    for await (const chunk of stream) {
        // puter stream chunks may be ChatResponseChunk or plain objects
        const deltaContent =
            typeof chunk === 'string'
                ? chunk
                : chunk?.text ?? chunk?.delta?.content ?? chunk?.choices?.[0]?.delta?.content ?? '';

        if (deltaContent === '' && !chunk?.done) continue;

        const sseChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: createdAt,
            model,
            choices: [
                {
                    index: 0,
                    delta: { role: 'assistant', content: deltaContent },
                    finish_reason: chunk?.done ? 'stop' : null,
                },
            ],
        };

        yield `data: ${JSON.stringify(sseChunk)}\n\n`;
    }

    yield 'data: [DONE]\n\n';
}

/**
 * List of popular Puter-supported models returned to the frontend.
 * Puter supports 500+ models; we expose a curated subset.
 */
export const PUTER_MODELS = [
    { id: 'gpt-4o' },
    { id: 'gpt-4o-mini' },
    { id: 'gpt-4.1' },
    { id: 'gpt-4.1-mini' },
    { id: 'o4-mini' },
    { id: 'claude-sonnet-4-5' },
    { id: 'claude-haiku-4-5' },
    { id: 'claude-opus-4-5' },
    { id: 'google/gemini-2.5-flash' },
    { id: 'google/gemini-2.5-pro' },
    { id: 'google/gemini-2.0-flash' },
    { id: 'deepseek/deepseek-chat' },
    { id: 'deepseek/deepseek-r1' },
    { id: 'meta-llama/llama-3.3-70b-instruct' },
    { id: 'mistralai/mistral-large-2' },
    { id: 'x-ai/grok-3-beta' },
    { id: 'qwen/qwen3-235b-a22b' },
];
