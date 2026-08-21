import { test, expect } from '@playwright/test';

test.describe('ReelRoom E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display landing page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /watch.*reels.*together/i })).toBeVisible();
        await expect(page.getByPlaceholder(/enter room code/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /create a room/i })).toBeVisible();
    });

    test('should navigate to create room page', async ({ page }) => {
        await page.getByRole('button', { name: /create a room/i }).click();
        await expect(page).toHaveURL('/create');
        await expect(page.getByRole('heading', { name: /create a room/i })).toBeVisible();
    });

    test('should create a room successfully', async ({ page }) => {
        await page.goto('/create');

        await page.getByLabel(/your name/i).fill('Test Host');
        await page.getByRole('button', { name: /create room/i }).click();

        // Should redirect to room page
        await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}/);

        // Should show room code
        await expect(page.locator('text=/Room:.*[A-Z0-9]{6}/')).toBeVisible();
    });

    test('should reject a badly formatted room code', async ({ page }) => {
        // Room codes are exactly 6 characters drawn from ROOM_CODE_CHARS in
        // packages/shared, which leaves out I, O, 0 and 1 so a code can never be
        // misread. 'ABCDI1' is the right length but uses two excluded
        // characters, so the app rejects it without troubling the server: it
        // stays where it is and explains what is wrong.
        await page.getByPlaceholder(/enter room code/i).fill('ABCDI1');
        await page.getByRole('button', { name: /join/i }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByText(/invalid room code format/i)).toBeVisible();
    });

    test('should show error for a room that does not exist', async ({ page }) => {
        // 'ZZZZZZ' is a valid shape, so the app navigates and asks the server,
        // which answers 404. JoinRoom is configured with retry: 1, so allow for
        // two attempts before the error panel renders.
        await page.getByPlaceholder(/enter room code/i).fill('ZZZZZZ');
        await page.getByRole('button', { name: /join/i }).click();

        await expect(page).toHaveURL('/join/ZZZZZZ');
        await expect(page.getByRole('heading', { name: /room not found/i })).toBeVisible({ timeout: 15000 });
    });

    test('should join existing room', async ({ page, context }) => {
        // First create a room
        await page.goto('/create');
        await page.getByLabel(/your name/i).fill('Host User');
        await page.getByRole('button', { name: /create room/i }).click();

        // Get room code from URL
        await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}/);
        const url = page.url();
        const roomCode = url.split('/room/')[1];

        // Open a new page to join as participant
        const participantPage = await context.newPage();
        await participantPage.goto(`/join/${roomCode}`);

        // Fill name and join
        await participantPage.getByLabel(/your name/i).fill('Participant User');
        await participantPage.getByRole('button', { name: /join room/i }).click();

        // Should be in the room
        await expect(participantPage).toHaveURL(`/room/${roomCode}`);

        // Original page should show 2 participants
        await expect(page.getByText(/2 watching/i)).toBeVisible();
    });

    test('should send and receive chat messages', async ({ page, context }) => {
        // Create room
        await page.goto('/create');
        await page.getByLabel(/your name/i).fill('Host');
        await page.getByRole('button', { name: /create room/i }).click();
        await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}/);

        const roomCode = page.url().split('/room/')[1];

        // Join as participant
        const participantPage = await context.newPage();
        await participantPage.goto(`/join/${roomCode}`);
        await participantPage.getByLabel(/your name/i).fill('Participant');
        await participantPage.getByRole('button', { name: /join room/i }).click();
        await expect(participantPage).toHaveURL(`/room/${roomCode}`);

        // Host sends message
        await page.getByPlaceholder(/type a message/i).fill('Hello from host!');
        await page.getByRole('button', { name: /send/i }).click();

        // Both should see the message
        await expect(page.getByText('Hello from host!')).toBeVisible();
        await expect(participantPage.getByText('Hello from host!')).toBeVisible();
    });

    test('should toggle dark mode', async ({ page }) => {
        // Check initial state (light mode by default)
        const html = page.locator('html');

        // Click theme toggle
        await page.getByRole('button', { name: /switch to.*mode/i }).click();

        // Should toggle dark class
        await expect(html).toHaveClass(/dark/);

        // Click again to toggle back
        await page.getByRole('button', { name: /switch to.*mode/i }).click();
        await expect(html).not.toHaveClass(/dark/);
    });

    test('should be accessible (WCAG)', async ({ page }) => {
        // Basic accessibility checks
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('banner')).toBeVisible();
        await expect(page.getByRole('contentinfo')).toBeVisible();

        // All interactive elements should be focusable
        const inputs = page.locator('input, button, a');
        const count = await inputs.count();

        for (let i = 0; i < count; i++) {
            const element = inputs.nth(i);
            if (await element.isVisible()) {
                await element.focus();
                // Element should be focused
                await expect(element).toBeFocused();
            }
        }
    });
});
