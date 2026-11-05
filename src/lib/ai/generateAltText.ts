import {z} from 'zod'

import {DEFAULT_ALT_TEXT_AI_PROMPT, MAX_ALT_TEXT} from '#/lib/constants'
import {logger} from '#/logger'
import {type AltTextAiConfig} from '#/state/preferences/openrouter'
import {APP_NAME} from '#/env'

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.union([
          z.string(),
          z.array(z.object({type: z.string(), text: z.string().optional()})),
        ]),
      }),
    }),
  ),
})

export function getChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('The AI API URL must start with http:// or https://')
  }
  return normalized.endsWith('/chat/completions')
    ? normalized
    : `${normalized}/chat/completions`
}

export function cleanGeneratedAltText(content: string): string {
  let text = content.trim()
  const reasoningEndTags = ['</think>', '</analysis>']
  let lastReasoningEnd = -1
  let lastReasoningEndLength = 0

  for (const tag of reasoningEndTags) {
    const index = text.toLowerCase().lastIndexOf(tag)
    if (index > lastReasoningEnd) {
      lastReasoningEnd = index
      lastReasoningEndLength = tag.length
    }
  }
  if (lastReasoningEnd >= 0) {
    text = text.slice(lastReasoningEnd + lastReasoningEndLength)
  }

  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .trim()
}

export async function generateAltText(
  config: AltTextAiConfig,
  imageBase64: string,
  imageMimeType: string,
): Promise<string> {
  const {model, apiKey} = config
  if (!model) {
    throw new Error('No vision model is configured')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://witchsky.app'
    headers['X-Title'] = APP_NAME
  }

  const response = await fetch(getChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: config.prompt || DEFAULT_ALT_TEXT_AI_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageMimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: MAX_ALT_TEXT,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error('AI alt text API error', {
      provider: config.provider,
      status: response.status,
      error: errorText,
    })
    throw new Error(`AI alt text API error: ${response.status}`)
  }

  const data = responseSchema.parse(await response.json())
  const content = data.choices?.[0]?.message?.content
  const rawAltText =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter(
              (part): part is {type: string; text: string} =>
                part.type === 'text' && typeof part.text === 'string',
            )
            .map(part => part.text)
            .join('')
        : undefined
  const altText = rawAltText ? cleanGeneratedAltText(rawAltText) : undefined

  if (!altText) {
    throw new Error('No alt text generated')
  }

  return altText
}
