import dns from 'node:dns';
import { Resolver } from 'node:dns/promises';
import net from 'node:net';

function timeoutPromise<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function lookupHost(host: string) {
  return new Promise<{ address: string; family: number }>((resolve, reject) => {
    dns.lookup(host, (error, address, family) => {
      if (error) return reject(error);
      resolve({ address, family });
    });
  });
}

async function resolveWithPublicDns(host: string) {
  const resolver = new Resolver();
  resolver.setServers(['1.1.1.1', '8.8.8.8']);

  const [a, aaaa] = await Promise.allSettled([
    timeoutPromise(resolver.resolve4(host), 3000, `resolve4:${host}`),
    timeoutPromise(resolver.resolve6(host), 3000, `resolve6:${host}`),
  ]);

  return {
    a: a.status === 'fulfilled' ? a.value : null,
    aError: a.status === 'rejected' ? String(a.reason) : null,
    aaaa: aaaa.status === 'fulfilled' ? aaaa.value : null,
    aaaaError: aaaa.status === 'rejected' ? String(aaaa.reason) : null,
  };
}

function testTcp(host: string, port: number, timeoutMs = 2500) {
  return new Promise<string>((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(`timeout (${timeoutMs}ms)`);
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve('ok');
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve(`error: ${(error as NodeJS.ErrnoException).code ?? error.message}`);
    });
  });
}

async function main() {
  const hosts = process.argv.slice(2);
  const targets =
    hosts.length > 0
      ? hosts
      : ['imapplepie20.tplinkdns.com', 'reb.or.kr', 'www.reb.or.kr', 'google.com'];

  console.log('=== DNS diagnose ===');
  console.log('platform:', process.platform, process.version);
  console.log('dns.getServers():', dns.getServers().join(', ') || '(empty)');
  console.log('');

  const tcp53 = await Promise.all([
    testTcp('1.1.1.1', 53),
    testTcp('8.8.8.8', 53),
  ]);
  console.log('tcp reachability');
  console.log('1.1.1.1:53 ->', tcp53[0]);
  console.log('8.8.8.8:53 ->', tcp53[1]);
  console.log('');

  for (const host of targets) {
    console.log(`[host] ${host}`);
    try {
      const looked = await timeoutPromise(lookupHost(host), 3000, `lookup:${host}`);
      console.log(`lookup -> ${looked.address} (IPv${looked.family})`);
    } catch (error) {
      const e = error as NodeJS.ErrnoException;
      console.log(`lookup -> error: ${e.code ?? e.message}`);
    }

    const publicDns = await resolveWithPublicDns(host);
    if (publicDns.a?.length) {
      console.log(`resolve4(1.1.1.1/8.8.8.8) -> ${publicDns.a.join(', ')}`);
    } else {
      console.log(`resolve4(1.1.1.1/8.8.8.8) -> error: ${publicDns.aError}`);
    }
    if (publicDns.aaaa?.length) {
      console.log(`resolve6(1.1.1.1/8.8.8.8) -> ${publicDns.aaaa.join(', ')}`);
    } else {
      console.log(`resolve6(1.1.1.1/8.8.8.8) -> error: ${publicDns.aaaaError}`);
    }
    console.log('');
  }
}

main().catch((error) => {
  console.error('diagnose failed:', error);
  process.exit(1);
});
