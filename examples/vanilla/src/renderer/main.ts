import { inject } from 'vitron/renderer';

const api = inject<{ ping: () => Promise<string> }>('vitron');
const output = document.querySelector<HTMLDivElement>('#app');

api.ping().then((response) => {
    if (output) {
        output.textContent = `Vitron is running. IPC response: ${response}`;
    }
}, (error: unknown) => {
    console.error(error);

    if (output) {
        output.textContent = 'Vitron IPC check failed. See the developer console.';
    }
});
