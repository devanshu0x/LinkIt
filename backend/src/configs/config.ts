type Rooms= Record<string,string[]>;
type Sockets=Record<string,string>;
type Users=Record<string,string>;

export const PORT=8080;
export const SYMBOLS="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const ROOM_ID_LEN=8;
export const rooms:Rooms={};
export const sockets:Sockets={};
export const users:Users={};