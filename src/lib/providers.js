/**
 * providers.js — 브라우저 fetch 기반 AI 프로바이더 유틸
 * 빌드리스 ESM (package.json type=module)
 *
 * exports:
 *   PROVIDERS        — 지원 프로바이더 목록
 *   tierFor(id)      — 모델 id → '무료' | '$20' | '$100'
 *   labelFor(id)     — 모델 id → 표시 라벨 (id + 티어 뱃지)
 *   listModels(provider, apiKey) → Promise<{id,label,tier}[]>
 *   generate(provider, apiKey, model, prompt, opts?) → Promise<string>
 */

// ──────────────────────────────────────────────────────────────────────────────
// 프로바이더 목록
// ──────────────────────────────────────────────────────────────────────────────
export const PROVIDERS = [
  { id: 'google',    label: 'Google Gemini' },
  { id: 'openai',   label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic Claude' },
];

// ──────────────────────────────────────────────────────────────────────────────
// 비용 티어 휴리스틱
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 모델 id로 비용 티어를 추정한다.
 *
 * 우선순위 (위에서 아래, 첫 매칭 기준):
 *  1. 무료  — Google Gemini Flash 계열 (flash 또는 flash-lite 포함, pro 없음)
 *  2. $100  — opus, pro 계열; gpt-5(mini/nano 제외); o1/o3 reasoning(mini/nano 제외)
 *  3. $20   — 그 외 (기본값: sonnet, haiku, mini, nano, flash-without-google, 4.1 등)
 *
 * @param {string} modelId
 * @returns {'무료' | '$20' | '$100'}
 */
export function tierFor(modelId) {
  const id = String(modelId).toLowerCase();

  // 1. 무료 — Google Flash 경량 (gemini 계열, flash 포함, pro 없음)
  const isGemini = id.includes('gemini');
  if (isGemini && id.includes('flash') && !id.includes('pro')) {
    return '무료';
  }

  // 2-a. $100 — opus (claude-opus-*)
  if (id.includes('opus')) return '$100';

  // 2-b. $100 — pro 포함 (gemini-*-pro, gpt-4-pro 등)
  if (id.includes('pro')) return '$100';

  // 2-c. $100 — gpt-5 계열 (mini/nano 제외)
  if (id.includes('gpt-5') && !id.includes('mini') && !id.includes('nano')) {
    return '$100';
  }

  // 2-d. $100 — o1/o3 reasoning 계열 (mini/nano 제외)
  //   패턴: 문자열이 'o1' 또는 'o3'으로 시작, 또는 정확히 그 값
  //   단, o1-mini · o3-mini 는 제외
  const isO1O3Family = /^o[13]($|-)/.test(id);
  if (isO1O3Family && !id.includes('mini') && !id.includes('nano')) {
    return '$100';
  }

  // 3. $20 — 그 외 (기본값)
  return '$20';
}

// ──────────────────────────────────────────────────────────────────────────────
// 표시 라벨
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 모델 id → 표시용 라벨 (id + 티어 뱃지)
 * @param {string} modelId
 * @returns {string}
 */
export function labelFor(modelId) {
  const tier = tierFor(modelId);
  return `${modelId}  [${tier}]`;
}

// ──────────────────────────────────────────────────────────────────────────────
// 내부 fetch 헬퍼 (에러 시 상태코드·원인 포함)
// ──────────────────────────────────────────────────────────────────────────────
async function apiFetch(url, init = {}) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new Error(`네트워크 오류 (fetch 실패): ${err.message}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`HTTP ${res.status}: ${detail || res.statusText}`);
  }

  return res.json();
}

// ──────────────────────────────────────────────────────────────────────────────
// 모델 목록 조회
// ──────────────────────────────────────────────────────────────────────────────
// OpenAI 제외 필터 (텍스트 생성 불가 모델 계열)
const OPENAI_EXCLUDE = [
  'embedding', 'whisper', 'tts', 'dall-e',
  'moderation', 'babbage', 'davinci', 'ada', 'curie', 'instruct',
];

/**
 * 프로바이더별 텍스트 생성 가능 모델 목록을 실시간 조회한다.
 *
 * @param {'google'|'openai'|'anthropic'} provider
 * @param {string} apiKey
 * @returns {Promise<Array<{id:string, label:string, tier:'무료'|'$20'|'$100'}>>}
 * @throws {Error} 상태코드·원인을 포함한 에러
 */
export async function listModels(provider, apiKey) {
  switch (provider) {
    // ── Google Gemini ────────────────────────────────────────────────────────
    case 'google': {
      const data = await apiFetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      ).catch(err => {
        throw new Error(`Google 모델 조회 실패: ${err.message}`);
      });

      return (data.models || [])
        .filter(m =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
        )
        .map(m => {
          const id = (m.name || '').replace(/^models\//, '');
          return { id, label: labelFor(id), tier: tierFor(id) };
        });
    }

    // ── OpenAI ───────────────────────────────────────────────────────────────
    case 'openai': {
      let data;
      try {
        data = await apiFetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      } catch (err) {
        throw new Error(
          `OpenAI 모델 조회 실패: ${err.message}` +
          (err.message.includes('네트워크')
            ? ' — 브라우저에서 OpenAI 직접 호출이 차단될 수 있음 (CORS)'
            : '')
        );
      }

      return (data.data || [])
        .filter(m => {
          const id = (m.id || '').toLowerCase();
          if (OPENAI_EXCLUDE.some(x => id.includes(x))) return false;
          // chat/completions 또는 responses 가능한 모델: gpt-* 또는 o<숫자> 시작
          return id.startsWith('gpt') || /^o\d/.test(id);
        })
        .map(m => ({
          id: m.id,
          label: labelFor(m.id),
          tier: tierFor(m.id),
        }));
    }

    // ── Anthropic Claude ─────────────────────────────────────────────────────
    case 'anthropic': {
      const data = await apiFetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }).catch(err => {
        throw new Error(`Anthropic 모델 조회 실패: ${err.message}`);
      });

      return (data.data || []).map(m => ({
        id: m.id,
        label: labelFor(m.id),
        tier: tierFor(m.id),
      }));
    }

    default:
      throw new Error(`알 수 없는 프로바이더: ${provider}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 텍스트 생성
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 프로바이더별 텍스트 생성
 *
 * @param {'google'|'openai'|'anthropic'} provider
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 * @param {{maxTokens?: number}} [opts]
 * @returns {Promise<string>}
 * @throws {Error} 상태코드·원인을 포함한 에러 (429 rate limit 포함)
 */
export async function generate(provider, apiKey, model, prompt, opts = {}) {
  switch (provider) {
    // ── Google Gemini ────────────────────────────────────────────────────────
    case 'google': {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const data = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }).catch(err => {
        throw new Error(`Google generate 실패 (${model}): ${err.message}`);
      });

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text == null) throw new Error('Google 응답에서 텍스트를 찾을 수 없음');
      return text;
    }

    // ── OpenAI ───────────────────────────────────────────────────────────────
    case 'openai': {
      let data;
      try {
        data = await apiFetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      } catch (err) {
        if (err.message.startsWith('HTTP 429')) {
          throw new Error(
            `OpenAI 요청 한도 초과 (429): 잠시 후 다시 시도하세요. (${err.message})`
          );
        }
        throw new Error(
          `OpenAI generate 실패 (${model}): ${err.message}` +
          (err.message.includes('네트워크')
            ? ' — 브라우저에서 OpenAI 직접 호출이 차단될 수 있음 (CORS)'
            : '')
        );
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content == null) throw new Error('OpenAI 응답에서 텍스트를 찾을 수 없음');
      return content;
    }

    // ── Anthropic Claude ─────────────────────────────────────────────────────
    case 'anthropic': {
      let data;
      try {
        data = await apiFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: opts.maxTokens || 2048,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      } catch (err) {
        if (err.message.startsWith('HTTP 429')) {
          throw new Error(
            `Anthropic 요청 한도 초과 (429): 잠시 후 다시 시도하세요. (${err.message})`
          );
        }
        throw new Error(`Anthropic generate 실패 (${model}): ${err.message}`);
      }

      const text = data?.content?.[0]?.text;
      if (text == null) throw new Error('Anthropic 응답에서 텍스트를 찾을 수 없음');
      return text;
    }

    default:
      throw new Error(`알 수 없는 프로바이더: ${provider}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 파일(첨부) 포함 텍스트 생성 — 멀티모달 (평가 계획안 분석용)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * PDF·이미지 파일을 함께 첨부해 텍스트를 생성한다. Google·Anthropic만 지원.
 * @param {'google'|'openai'|'anthropic'} provider
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 * @param {{mime:string, base64:string}} file  base64는 data URL 접두사 없는 순수 base64
 * @returns {Promise<string>}
 */
export async function generateWithFile(provider, apiKey, model, prompt, file) {
  if (!file || !file.base64) throw new Error('첨부 파일이 없습니다.');
  const isPdf = file.mime === 'application/pdf';

  switch (provider) {
    case 'google': {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const data = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: file.mime, data: file.base64 } },
          ] }],
        }),
      }).catch((err) => { throw new Error(`Google 파일 분석 실패 (${model}): ${err.message}`); });
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text == null) throw new Error('Google 응답에서 텍스트를 찾을 수 없음');
      return text;
    }

    case 'anthropic': {
      const filePart = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: file.mime, data: file.base64 } };
      const data = await apiFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, filePart] }],
        }),
      }).catch((err) => {
        if (err.message.startsWith('HTTP 429')) throw new Error('Anthropic 요청 한도 초과 (429): 잠시 후 다시 시도하세요.');
        throw new Error(`Anthropic 파일 분석 실패 (${model}): ${err.message}`);
      });
      const text = data?.content?.[0]?.text;
      if (text == null) throw new Error('Anthropic 응답에서 텍스트를 찾을 수 없음');
      return text;
    }

    case 'openai':
      throw new Error('OpenAI는 이 앱에서 평가 계획안 파일 분석을 지원하지 않습니다. Google 또는 Anthropic 키를 사용하세요.');

    default:
      throw new Error(`알 수 없는 프로바이더: ${provider}`);
  }
}

