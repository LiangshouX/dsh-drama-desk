/**
 * Parse the spec (规范) into the shape the UI renders.
 *
 * `spec/` is the **only** source of truth for rules, thresholds and contracts.
 * The plugin never restates a rule, a threshold or a stage list — it parses
 * them out of the release-state markdown so that "改一处即全局生效" holds for
 * the UI as well as for the agent.
 *
 * The rule block format is fixed by the data contract:
 *
 *     ## R13 标题
 *
 *     <依据 / 实测证据正文>
 *
 *     适用阶段：storyboard、generate。
 *
 * The `适用阶段：` line is always the last line of a rule block, so the parser
 * reads a rule as "heading → body → stage line".
 */
import { join } from 'node:path'
import { readTextIfExists } from './fsx.js'
import { SPEC_DIR } from './paths.js'

/** A rule id + title, as written in `## R13 标题`. */
const RULE_HEADING = /^##\s+R(\d+)\s+(.+)$/
/** The stage line that closes a rule block. */
const STAGE_LINE = /^适用阶段：(.+?)。?\s*$/

/** The pipeline stage order used by the state machine. */
export const STAGES = [
  'conceive',
  'outline',
  'characters',
  'script',
  'storyboard',
  'generate',
  'verify',
  'assemble',
  'deliver',
]

/**
 * Split markdown into flat sections keyed by heading level.
 *
 * @param {string} markdown
 * @returns {{level: number, heading: string, body: string}[]}
 */
export function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/)
  const sections = []
  let current
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading !== null) {
      current = { level: heading[1].length, heading: heading[2].trim(), body: '' }
      sections.push(current)
      continue
    }
    if (current !== undefined) current.body += `${line}\n`
  }
  return sections
}

/**
 * Parse the rule file into rule records.
 *
 * @param {string} markdown the model-specific rule file
 * @returns {{id: string, title: string, stages: string[], body: string, evidence: string, evidenceLabel: string|null}[]}
 */
export function parseRules(markdown) {
  const rules = []
  const lines = markdown.split(/\r?\n/)
  let current
  for (const line of lines) {
    const heading = RULE_HEADING.exec(line)
    if (heading !== null) {
      current = { id: `R${heading[1]}`, title: heading[2].trim(), stages: [], bodyLines: [] }
      rules.push(current)
      continue
    }
    if (current === undefined) continue
    const stage = STAGE_LINE.exec(line.trim())
    if (stage !== null) {
      current.stages = stage[1]
        .split('、')
        .map(item => item.trim())
        .filter(item => item !== '')
      continue
    }
    current.bodyLines.push(line)
  }
  return rules.map(rule => {
    const body = rule.bodyLines.join('\n').trim()
    const { evidence, evidenceLabel } = extractEvidence(body)
    return { id: rule.id, title: rule.title, stages: rule.stages, body, evidence, evidenceLabel }
  })
}

/**
 * Split the leading paragraph off a rule body: it is the "依据" (why this
 * rule exists), the rest is the rule's own prescription.
 */
function extractEvidence(body) {
  const paragraphs = body.split(/\n\s*\n/).map(part => part.trim()).filter(part => part !== '')
  if (paragraphs.length === 0) return { evidence: '', evidenceLabel: null }
  const first = paragraphs[0]
  const labelled = /^依据：(.+)$/s.exec(first)
  if (labelled !== null) return { evidence: labelled[1].trim(), evidenceLabel: '依据' }
  return { evidence: first, evidenceLabel: null }
}

/**
 * Build a nested section tree (for the contract / constitution / checklist).
 *
 * @param {string} markdown
 * @returns {{heading: string, level: number, body: string, children: object[]}[]}
 */
export function parseSectionTree(markdown) {
  const flat = parseSections(markdown)
  const root = []
  const stack = []
  for (const section of flat) {
    const node = { heading: section.heading, level: section.level, body: section.body.trim(), children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length === 0) root.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return root
}

/**
 * Parse the contract's **prerequisite table** (§11.2 前置条件).
 *
 * The table is the contract's own wording for "what must exist before the
 * pipeline may advance". The plugin shows that wording verbatim and pairs it
 * with a checker — the checker lives in `stages.js`, the wording here.
 * Neither copies the other: change the contract, the UI's wording follows.
 *
 * @param {string} markdown the data contract
 * @returns {{stage: string, requirement: string}[]}
 */
export function parsePrerequisites(markdown) {
  const lines = markdown.split(/\r?\n/)
  const rows = []
  let inTable = false
  for (const line of lines) {
    if (/^###\s+11\.2/.test(line)) { inTable = true; continue }
    if (inTable && /^#{1,3}\s+/.test(line)) { inTable = false; continue }
    if (!inTable) continue
    const row = /^\|\s*`([a-z]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line)
    if (row === null) continue
    rows.push({ stage: row[1], requirement: row[2] })
  }
  return rows
}

/**
 * Load the whole spec for one model.
 *
 * Reads the **release state** (`build/spec`), never `src/spec`: the release
 * state is what ships, and what the build script validated.
 */
export async function loadSpec(modelId) {
  const coreDir = join(SPEC_DIR, 'core')
  const modelDir = join(SPEC_DIR, 'models', modelId)
  const [rulesText, constitutionText, contractText, checklistText] = await Promise.all([
    readTextIfExists(join(modelDir, 'rules.md')),
    readTextIfExists(join(coreDir, 'constitution.md')),
    readTextIfExists(join(coreDir, '数据契约.md')),
    readTextIfExists(join(coreDir, '验收清单.md')),
  ])
  const available = rulesText !== undefined
    || constitutionText !== undefined
    || contractText !== undefined
    || checklistText !== undefined
  return {
    model: modelId,
    available,
    rules: rulesText === undefined ? [] : parseRules(rulesText),
    constitution: constitutionText === undefined ? [] : parseSectionTree(constitutionText),
    contract: contractText === undefined ? [] : parseSectionTree(contractText),
    checklist: checklistText === undefined ? [] : parseSectionTree(checklistText),
    prerequisites: contractText === undefined ? [] : parsePrerequisites(contractText),
    sources: {
      rules: rulesText === undefined ? undefined : `build/spec/models/${modelId}/rules.md`,
      constitution: constitutionText === undefined ? undefined : 'build/spec/core/constitution.md',
      contract: contractText === undefined ? undefined : 'build/spec/core/数据契约.md',
      checklist: checklistText === undefined ? undefined : 'build/spec/core/验收清单.md',
    },
  }
}
