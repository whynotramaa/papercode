import { Badge } from '../components/Badge'
import { CodeBlock } from '../components/CodeBlock'
import { Filter, AlertCircle } from 'lucide-react'

export function ProvidersSection() {
  return (
    <section id="providers" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#00bae2] font-mono">
            {'{ Provider Abstraction }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">OpenAI-Compatible &middot; Dynamic Discovery &middot; Error Translation</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Provider abstraction and model discovery
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          PaperCode connects to any provider that speaks the OpenAI Chat Completions protocol. By standardizing on the official OpenAI SDK with base URL overrides, users can connect to cloud hosted APIs or local models with zero code changes.
        </p>
      </div>

      {/* Preset Providers Grid */}
      <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#42433d] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#fffce1]">
              Supported provider endpoints
            </h3>
            <p className="text-xs text-[#7c7c6f]">
              Built-in presets in /connect walkthrough
            </p>
          </div>
          <Badge variant="blue">Presets</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 font-mono text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1">
            <div className="font-semibold text-[#fffce1]">OpenAI</div>
            <div className="text-[11px] text-[#7c7c6f]">https://api.openai.com/v1</div>
            <div className="mt-2 text-[10px] text-[#00bae2]">Key: sk-...</div>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1">
            <div className="font-semibold text-[#fffce1]">OpenRouter</div>
            <div className="text-[11px] text-[#7c7c6f]">https://openrouter.ai/api/v1</div>
            <div className="mt-2 text-[10px] text-[#9d95ff]">Key: sk-or-...</div>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1">
            <div className="font-semibold text-[#fffce1]">Groq</div>
            <div className="text-[11px] text-[#7c7c6f]">https://api.groq.com/openai/v1</div>
            <div className="mt-2 text-[10px] text-[#ff8709]">Key: gsk_...</div>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1">
            <div className="font-semibold text-[#fffce1]">Together AI</div>
            <div className="text-[11px] text-[#7c7c6f]">https://api.together.xyz/v1</div>
            <div className="mt-2 text-[10px] text-[#abff84]">Key: Custom</div>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1">
            <div className="font-semibold text-[#fffce1]">DeepSeek</div>
            <div className="text-[11px] text-[#7c7c6f]">https://api.deepseek.com/v1</div>
            <div className="mt-2 text-[10px] text-[#00bae2]">Key: sk-...</div>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1">
            <div className="font-semibold text-[#fffce1]">Ollama (Local)</div>
            <div className="text-[11px] text-[#7c7c6f]">http://localhost:11434/v1</div>
            <div className="mt-2 text-[10px] text-[#7c7c6f]">Key: Optional ("not-needed")</div>
          </div>
        </div>
      </div>

      {/* The Zero-Retry Policy */}
      <div className="space-y-4">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Client Configuration }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The zero-retry policy in client creation
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          The official OpenAI Node SDK defaults to two automatic retries with exponential backoff on HTTP 429 and 500 errors. PaperCode explicitly overrides this to zero.
        </p>

        <CodeBlock
          file="src/providers/client.ts"
          language="typescript"
          highlightLines={[6]}
          code={`export function createClient(provider: Provider): OpenAI {
  return new OpenAI({
    apiKey: provider.apiKey || "not-needed",
    baseURL: provider.baseURL,
    // The UI owns retries: a silent SDK retry looks like a hang mid-stream.
    maxRetries: 0,
  });
}`}
        />

        <p className="text-xs text-[#7c7c6f] leading-relaxed max-w-3xl">
          In a graphical browser application, background retries are invisible. In an interactive terminal application, silent backoff pauses look like frozen processes. Setting maxRetries to 0 lets the terminal catch errors immediately and surface actionable notices.
        </p>
      </div>

      {/* Model Filtering and Ranking */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-[#00bae2]" />
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            Dynamic model discovery and chat filtering
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          When contacting a provider's /v1/models endpoint, the returned list often contains hundreds of items, including embedding models, text-to-speech engines, image generators, and rerankers. PaperCode filters out non-chat models and ranks coding flagships first.
        </p>

        <CodeBlock
          file="src/providers/models.ts"
          language="typescript"
          code={`const NON_CHAT = /(^|[-/])(embed|embedding|whisper|tts|dall-e|moderation|rerank|clip|stable-diffusion)/i;

export function isChatModel(id: string): boolean {
  return !NON_CHAT.test(id);
}

function rank(id: string): number {
  if (/gpt-5|claude-opus|claude-sonnet|o[34]-/i.test(id)) return 0;
  if (/gpt-4|claude|llama-3|deepseek|qwen/i.test(id)) return 1;
  return 2;
}`}
        />
      </div>

      {/* Actionable Error Translation */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-[#ff8709]" />
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            Actionable error translation
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Raw HTTP status codes and JSON error dumps confuse users. The <code className="font-mono text-xs text-[#fffce1]">describeError</code> utility maps HTTP status codes into concrete instructions.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-4 space-y-1">
            <div className="font-mono font-semibold text-[#ff8709]">HTTP 401 Unauthorized</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              "Authentication failed (401). The API key for this provider looks invalid, re-add it with /connect."
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-4 space-y-1">
            <div className="font-mono font-semibold text-[#ff8709]">HTTP 404 Not Found</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              "Not found (404). The model may not exist at this provider, or the baseURL may be wrong."
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-4 space-y-1">
            <div className="font-mono font-semibold text-[#9d95ff]">HTTP 429 Rate Limited</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              "Rate limited (429). Shows upstream rate limit detail and allows user to switch models with /models."
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-4 space-y-1">
            <div className="font-mono font-semibold text-[#00bae2]">APIConnectionError</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              "Could not reach the provider. Check the baseURL and your connection."
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
