import { merge } from 'smob';
import type { InlineConfig, UserConfig } from 'vite';

/**
 * Apply a user config hook. The hook may mutate its input, return it,
 * or return a new object, which is merged with the input (returned values win).
 */
export function applyConfigHook(
    input: InlineConfig,
    hook: (config: InlineConfig) => UserConfig | void,
) : InlineConfig {
    const returned = hook(input);

    if (!returned || returned === input) {
        return input;
    }

    return merge(returned, input) as InlineConfig;
}
