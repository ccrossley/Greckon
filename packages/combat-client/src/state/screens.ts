export type ClientScreen =
  | 'loading'
  | 'login'
  | 'lobby'
  | 'combat_secret_draft'
  | 'combat_unit_pick'
  | 'combat_fight_playback'
  | 'combat_action_selection'
  | 'combat_round_end'
  | 'combat_match_end';

export const COMBAT_SCREENS: ClientScreen[] = [
  'combat_secret_draft',
  'combat_unit_pick',
  'combat_fight_playback',
  'combat_action_selection',
  'combat_round_end',
  'combat_match_end',
];

export function isCombatScreen(screen: ClientScreen): boolean {
  return COMBAT_SCREENS.includes(screen);
}
