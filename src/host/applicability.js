/**
 * Which rule applies to which shot.
 *
 * The spec says **what** a rule is and **when** it holds; it does not say
 * "which shots does this rule currently bite". The UI has to answer that, so
 * this module holds the missing half — and it holds only that half:
 *
 *  - rule **text**, **thresholds**, **stage lists** come from `spec/` (parsed,
 *    never restated);
 *  - a rule id maps to a **predicate over one shot's concrete fields**.
 *
 * A rule id that is not listed here still appears in the contract view (it is
 * a real rule), but it has no shot-level verdict — the UI shows it as "未落到
 * 具体镜头" instead of guessing.
 */

/** The stages a shot's lifecycle spans: authored at storyboard, rendered at generate. */
export const SHOT_STAGES = ['storyboard', 'generate']

/**
 * Shot-level predicates.
 *
 * Each entry receives a `subject` built by the service:
 *
 *   shot          the shot record from shots.json
 *   scene         the owning scene record
 *   dialogue      the shot's dialogue beats (derived field)
 *   beats         the beats the shot covers
 *   prompt        the compiled prompt artifact text (or undefined)
 *   hasVideo      whether a video asset exists for the shot
 *   hasImage      whether the shot references at least one image asset
 *   ledger        the newest ledger entry for the shot
 *   cameraMove    the camera field names a move other than a static one
 *   bigAction     the shot declares a body action with real displacement
 */
const PREDICATES = {
  R1: subject => subject.hasImage,
  R2: subject => subject.hasImage,
  R3: subject => subject.dialogue.length > 0,
  R4: () => false,
  R5: subject => subject.hasQc,
  R6: subject => subject.hasImage,
  R7: subject => subject.hasImage,
  R8: () => false,
  R9: subject => subject.dialogue.length > 0,
  R10: () => false,
  R11: subject => subject.dialogue.length > 0,
  R12: () => false,
  R13: subject => subject.promptMentionsStatic
      || (typeof subject.shot.camera === 'string' && /\bstatic\b/i.test(subject.shot.camera)),
  R14: subject => subject.cameraMove && subject.bigAction,
  R15: subject => subject.hasVideo,
  R16: subject => subject.hasVideo,
  R17: subject => subject.prompt !== undefined,
  R18: subject => subject.dialogue.length > 0,
  R19: subject => subject.hasVideo,
  R20: subject => subject.ledger?.status === 'submitting' && !subject.ledger?.task_id,
}

/**
 * Whether a rule applies to a shot.
 *
 * Two gates, in order: the rule's own `适用阶段` list, then the shot-level
 * predicate. A rule without a predicate only passes the stage gate.
 *
 * @param {{id: string, stages: string[]}} rule
 * @param {object} subject
 * @returns {{applicable: boolean, reason: string}}
 */
export function judgeRule(rule, subject) {
  const stageOk = rule.stages.length === 0 || rule.stages.some(stage => SHOT_STAGES.includes(stage))
  if (!stageOk) {
    return { applicable: false, reason: `适用阶段（${rule.stages.join('、')}）不含本镜所在的 ${SHOT_STAGES.join(' / ')}` }
  }
  const predicate = PREDICATES[rule.id]
  if (predicate === undefined) {
    return { applicable: false, reason: '未落到具体镜头（这条规范不按镜头判定）' }
  }
  const applicable = predicate(subject) === true
  return applicable
    ? { applicable: true, reason: '' }
    : { applicable: false, reason: '本镜不满足这条规范的触发条件' }
}

/** Rule ids that carry a shot-level predicate, for documentation and tests. */
export const PREDICATED_RULE_IDS = Object.keys(PREDICATES)
