import { createMerger } from 'smob';
import type { InlineConfig, UserConfig } from 'vite';

// A value the hook passed through unchanged must not be merged with itself, which would register its plugins twice.
const merge = createMerger({ strategy: (target, key, value) => (target[key] === value ? target : undefined) });

/**
 * Apply a user config hook, if there is one. The hook may mutate its input, return it,
 * or return a new object, which is merged with the input (returned values win).
 */
export function applyConfigHook(
    input: InlineConfig,
    hook: ((config: InlineConfig) => UserConfig | void) | undefined,
) : InlineConfig {
    if (!hook) {
        return input;
    }

    const returned = hook(input);

    if (!returned || returned === input) {
        return input;
    }

    return merge(returned, input) as InlineConfig;
}
