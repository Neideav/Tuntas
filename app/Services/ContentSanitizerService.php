<?php

namespace App\Services;

class ContentSanitizerService
{
    /**
     * Sanitize HTML/Markdown content to prevent Stored XSS attacks
     * while preserving rich text formatting, headings, code blocks, lists, and links.
     */
    public function sanitize(?string $content): string
    {
        if (empty($content)) {
            return '';
        }

        // 1. Strip dangerous tags completely
        $dangerousTags = [
            '/<script\b[^>]*>(.*?)<\/script>/is',
            '/<iframe\b[^>]*>(.*?)<\/iframe>/is',
            '/<object\b[^>]*>(.*?)<\/object>/is',
            '/<embed\b[^>]*>(.*?)<\/embed>/is',
            '/<applet\b[^>]*>(.*?)<\/applet>/is',
            '/<meta\b[^>]*>/is',
            '/<link\b[^>]*>/is',
            '/<style\b[^>]*>(.*?)<\/style>/is',
            '/<form\b[^>]*>(.*?)<\/form>/is',
        ];
        $sanitized = preg_replace($dangerousTags, '', $content);

        // 2. Strip inline event handlers like onerror, onclick, onload, etc.
        $sanitized = preg_replace('/\s*on[a-zA-Z]+\s*=\s*(["\']).*?\1/is', '', $sanitized);
        $sanitized = preg_replace('/\s*on[a-zA-Z]+\s*=\s*[^>\s]+/is', '', $sanitized);

        // 3. Strip dangerous URL protocols (javascript:, data:text/html, vbscript:)
        $sanitized = preg_replace('/href\s*=\s*(["\'])\s*(javascript|vbscript|data:text\/html):.*?\1/is', 'href="#"', $sanitized);
        $sanitized = preg_replace('/src\s*=\s*(["\'])\s*(javascript|vbscript):.*?\1/is', 'src=""', $sanitized);

        return trim($sanitized);
    }

    /**
     * Extract user mentions like @username or @email and role mentions like @role:slug from content.
     */
    public function extractMentions(string $content): array
    {
        $userMentions = [];
        $roleMentions = [];

        // Match @[username] or @username
        if (preg_match_all('/@([a-zA-Z0-9_\.\-]+)/', $content, $matches)) {
            foreach ($matches[1] as $match) {
                if (str_starts_with($match, 'role:')) {
                    $roleMentions[] = substr($match, 5);
                } else {
                    $userMentions[] = $match;
                }
            }
        }

        return [
            'users' => array_values(array_unique($userMentions)),
            'roles' => array_values(array_unique($roleMentions)),
        ];
    }

    /**
     * Alias for sanitize to ensure backward and forward compatibility.
     */
    public function sanitizeHtml(?string $content): string
    {
        return $this->sanitize($content);
    }

    /**
     * Extract mentions and store them in the mentions table for any mentionable model.
     */
    public function extractAndStoreMentions($user, $mentionable, string $content, ?int $projectId = null): void
    {
        $extracted = $this->extractMentions($content);

        // Delete previous mentions for this model
        $mentionable->mentions()->delete();

        // Mentioned Users
        if (!empty($extracted['users'])) {
            $users = \App\Models\User::whereIn('name', $extracted['users'])
                ->orWhereIn('email', $extracted['users'])
                ->get();

            foreach ($users as $u) {
                $mentionable->mentions()->create([
                    'mentioner_id' => $user->id,
                    'mentioned_user_id' => $u->id,
                    'project_id' => $projectId,
                ]);
            }
        }

        // Mentioned Roles
        if (!empty($extracted['roles']) && $projectId) {
            $roles = \App\Models\ProjectRole::where('project_id', $projectId)
                ->whereIn('slug', $extracted['roles'])
                ->get();

            foreach ($roles as $r) {
                $mentionable->mentions()->create([
                    'mentioner_id' => $user->id,
                    'mentioned_role_id' => $r->id,
                    'project_id' => $projectId,
                ]);
            }
        }
    }
}
