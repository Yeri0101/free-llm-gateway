module.exports = {
    apps: [
        {
            name: 'mission-control',
            cwd: '/home/ken/.openclaw/workspace/mission-control',
            script: 'npm',
            args: 'run dev',
            watch: false,
            env: {
                NODE_ENV: 'development',
            },
        },
        {
            name: 'openclaw-backend',
            cwd: './backend',
            script: 'npm',
            args: 'run dev',
            watch: false,
            env: {
                NODE_ENV: 'development',
            },
        },
        {
            name: 'openclaw-frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'run dev',
            watch: false,
            env: {
                NODE_ENV: 'development',
            },
        },
        {
            name: 'openclaw-batch-worker',
            cwd: './batch-worker',
            script: 'npm',
            args: 'run dev',
            watch: false,
            env: {
                NODE_ENV: 'development',
            },
        },
    ],
};
