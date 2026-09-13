import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-weathernext',
    version: '0.0.1',
    icon: '🤖',
    title: 'Google WeatherNext Forecast',
    description: 'Google WeatherNext Forecast plugin for Windy.com',
    author: 'Quentin Mazars-Simon',
    repository: 'https://github.com/quentinms/windy-plugin-weathernext',
    desktopUI: 'rhpane',
    desktopWidth: 600,
    mobileUI: 'fullscreen',
    routerPath: '/weathernext/:lat?/:lon?',
    addToContextmenu: true,
    private: true,
};

export default config;
