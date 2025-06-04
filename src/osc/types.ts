export interface OSCArgument {
  type: string;
  value: any;
}

export interface OSCMessage {
  address: string;
  args: OSCArgument[];
}
