import { spawn, spawnSync } from 'node:child_process';

function commandExists(name) {
  const result = spawnSync('sh', ['-c', `command -v ${name}`], { stdio: 'ignore' });
  return result.status === 0;
}

function shellArgs(command) {
  const shell = process.env.SHELL || '/bin/bash';
  return { shell, args: ['-lc', command] };
}

/**
 * Open a new terminal window running `command`, or return false if none available.
 */
export function openTerminalWindow(title, command) {
  const { shell } = shellArgs(command);
  const wrapped = `${command}; code=$?; echo; echo "[${title} exited $code] Press Enter to close."; read _`;

  const launchers = [
    {
      name: 'gnome-terminal',
      spawn: () =>
        spawn('gnome-terminal', ['--title', title, '--', shell, '-lc', wrapped], {
          detached: true,
          stdio: 'ignore',
        }),
    },
    {
      name: 'konsole',
      spawn: () =>
        spawn(
          'konsole',
          ['--new-tab', '-p', `tabtitle=${title}`, '-e', shell, '-lc', wrapped],
          { detached: true, stdio: 'ignore' },
        ),
    },
    {
      name: 'xfce4-terminal',
      spawn: () =>
        spawn('xfce4-terminal', ['--title', title, '-e', `${shell} -lc ${JSON.stringify(wrapped)}`], {
          detached: true,
          stdio: 'ignore',
        }),
    },
    {
      name: 'xterm',
      spawn: () =>
        spawn('xterm', ['-title', title, '-hold', '-e', shell, '-lc', wrapped], {
          detached: true,
          stdio: 'ignore',
        }),
    },
    {
      name: 'kitty',
      spawn: () =>
        spawn('kitty', ['bash', '-lc', wrapped], {
          detached: true,
          stdio: 'ignore',
        }),
    },
  ];

  for (const launcher of launchers) {
    if (!commandExists(launcher.name)) {
      continue;
    }
    const child = launcher.spawn();
    child.unref();
    return launcher.name;
  }

  return false;
}
