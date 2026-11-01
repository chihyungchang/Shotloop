// The turn loop every API backend shares: one model request per turn,
// its tool calls answered, until the model stops calling tools.

// Turns a task may take unless it says otherwise (CLI agents get it too)
export const MAX_TURNS = 40
