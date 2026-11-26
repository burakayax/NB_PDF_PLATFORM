export type AudienceTag = { label: string; blog?: string; tool?: string };
export declare const audiencePath: (tag: AudienceTag) => string;
export declare const AUDIENCE_TAGS: { tr: AudienceTag[]; en: AudienceTag[] };
