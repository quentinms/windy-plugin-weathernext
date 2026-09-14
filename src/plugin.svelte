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
    {#if location}
        {@const { lat, lon } = location}
        <a
            href={`https://deepmind.google.com/science/weatherlab?zoom=6&center=${lat},${lon}&panel=point-forecast&location=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
        >
            > View on Google Weatherlab
        </a>
    {/if}
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

    import { quantile } from 'd3-array';

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
            models: 'google_weathernext2_ensemble_mean,google_weathernext2_ensemble',
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
                        temperature_mean:
                            response.hourly.temperature_2m_google_weathernext2_ensemble_mean,
                        temperature_p10: [],
                        temperature_p90: [],
                    },
                    units: {
                        temperature:
                            response.hourly_units.temperature_2m_google_weathernext2_ensemble_mean,
                    },
                };

                const ensembleData = Object.keys(response.hourly)
                    .filter(key => key.startsWith('temperature_2m_member'))
                    .map(key => {
                        return response.hourly[key];
                    });
                const { p10, p90 } = computeStats(ensembleData);
                weatherData.hourly.temperature_p10 = p10;
                weatherData.hourly.temperature_p90 = p90;

                updateChart(weatherData);
            });
    }

    function updateChart(weatherData) {
        options = {
            ...options,
            xAxis: {
                type: 'datetime',
                title: { text: 'Date' },
                tickInterval: 24 * 3600 * 1000, // one day
            },
            yAxis: {
                title: { text: `${weatherData.units.temperature}` },
            },
            series: [
                {
                    name: 'temperature mean',
                    data: Array.from(weatherData.hourly.temperature_mean).map((value, index) => [
                        weatherData.hourly.time[index],
                        value,
                    ]),
                },
                {
                    name: 'temperature p10',
                    data: Array.from(weatherData.hourly.temperature_p10).map((value, index) => [
                        weatherData.hourly.time[index],
                        value,
                    ]),
                    opacity: 0.2,
                    color: 'black',
                },
                {
                    name: 'temperature p90',
                    data: Array.from(weatherData.hourly.temperature_p90).map((value, index) => [
                        weatherData.hourly.time[index],
                        value,
                    ]),
                    opacity: 0.2,
                    color: 'black',
                },
            ],
        };
    }

    // For each ensemble series, compute the p10 and p90 at a given time step,
    // and return an array of p10 and p90 values for each time step
    function computeStats(ensembleSeries: Array<Array<number>>) {
        const zipped = zip(...ensembleSeries);
        const p10 = zipped.map(values => {
            return quantile(values, 0.1);
        });
        const p90 = zipped.map(values => {
            return quantile(values, 0.9);
        });
        return {
            p10,
            p90,
        };
    }

    // TODO: replace with https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/zip once it's more generally available
    function zip(...arrays: Array<Array<number>>): Array<Array<number>> {
        return Array.from({ length: arrays[0].length }, (_, i) => arrays.map(arr => arr[i]));
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
