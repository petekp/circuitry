export function containsIp(cidr, ip) {
  const [network, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (toInt(network) & mask) === (toInt(ip) & mask);
}

function toInt(ip) {
  return ip.split('.').reduce((value, octet) => (value << 8) + Number(octet), 0);
}
