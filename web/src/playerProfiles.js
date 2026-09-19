export const GAMEPLAY_PROFILES = {
  GK:{overall:78,pace:58,shooting:35,passing:62,dribbling:45,defending:82,physical:78,stamina:72,goalkeeper:90},
  DEF:{overall:76,pace:72,shooting:38,passing:68,dribbling:54,defending:82,physical:82,stamina:84,goalkeeper:5},
  MID:{overall:78,pace:78,shooting:66,passing:84,dribbling:82,defending:64,physical:70,stamina:90,goalkeeper:5},
  FWD:{overall:80,pace:88,shooting:86,passing:72,dribbling:88,defending:38,physical:74,stamina:82,goalkeeper:5}
};
export function createGamePlayerProfile(role, overrides={}){
  return {...GAMEPLAY_PROFILES[role],...overrides};
}
