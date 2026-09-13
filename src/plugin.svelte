<div class="plugin__mobile-header">
    {title}
</div>
<section class="plugin__content">
    <div
        class="plugin__title plugin__title--chevron-back"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        {title}
        {#if reverseName && location}
            {@const { lat, lon } = location}
            <div class="plugin__title__subtitle">
                {reverseName} at {normalizeLatLon(lat)}, {normalizeLatLon(lon)}
            </div>
        {/if}
    </div>
    <Chart {options} highcharts={Highcharts} />
</section>

<script lang="ts">
    import { onDestroy, onMount } from 'svelte';

    import bcast from '@windy/broadcast';
    import { isValidLatLonObj, normalizeLatLon } from '@windy/utils';
    import { map } from '@windy/map';
    import * as reverse from '@windy/reverseName';
    import type { LatLon } from '@windy/interfaces.d';
    import { getMyLatestPos } from '@windy/geolocation';

    import config from './pluginConfig';

    import Highcharts from 'highcharts';
    import 'highcharts/modules/exporting';
    import { Chart } from '@highcharts/svelte';

    let location: LatLon | null = null;
    let reverseName: string | null = null;

    let options = {
        chart: {
            type: 'line',
        },
        title: {
            text: 'Weather Forecast',
        },
        accessibility: {
            enabled: true,
        },
    };

    const { title } = config;

    function loadForecastAndUpdateChart(location: LatLon) {
        const params = {
            latitude: location.lat,
            longitude: location.lon,
            hourly: 'temperature_2m',
            forecast_days: 7,
            models: 'google_weathernext2_ensemble_mean',
        };
        const url = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${params.latitude}&longitude=${params.longitude}&hourly=${params.hourly}&timezone=auto&forecast_days=${params.forecast_days}&models=${params.models}`;
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(response => response.json())
            .then(res => {
                const response = res;

                const weatherData = {
                    hourly: {
                        time: response.hourly.time,
                        temperature_2m: response.hourly.temperature_2m,
                    },
                };

                updateChart(
                    weatherData.hourly.time,
                    weatherData.hourly.temperature_2m,
                    response.hourly_units.temperature_2m,
                );
            });
    }

    function updateChart(time: Array<Date>, values: Array<number>, unit: string) {
        options = {
            ...options,
            xAxis: {
                type: 'datetime',
                title: { text: 'Date' },
                tickInterval: 24 * 3600 * 1000, // one day
            },
            yAxis: {
                title: { text: `${unit}` },
            },
            series: [
                {
                    name: 'temperature',
                    data: Array.from(values).map((value, index) => [time[index], value]),
                },
            ],
        };
    }

    // If plugin is opened from RH menu, it is called with location
    // if not, the location param is undefined
    export const onopen = (loc?: LatLon) => {
        // Your plugin was opened with parameters parsed from URL
        // or with LatLon object if opened from contextmenu
        if (isValidLatLonObj(loc)) {
            location = loc;
        } else {
            location = getMyLatestPos();
        }
        reverse.get(location).then(({ name }) => {
            reverseName = name;
        });
        loadForecastAndUpdateChart(location);
    };

    onMount(() => {});

    onDestroy(() => {});
</script>

<style lang="less">
    // Put any LESS of CSS styles here
</style>
