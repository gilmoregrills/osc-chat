declare module 'ip-to-int' {
  function ipToInt(ip: string): {
    toInt: () => number;
  };
  export default ipToInt;
}
