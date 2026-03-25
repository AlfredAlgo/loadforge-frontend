type Listerner = (event: any) => void;

const listeners = new Set<Listerner>();

export function publish(event: any) {
  listeners.forEach((listener) => listener(event));
}

export function subscribe(listener: Listerner) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
