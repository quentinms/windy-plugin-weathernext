<div class="plugin__mobile-header">
    {title}
</div>
<section class="plugin__content">
    <div
        class="plugin__title plugin__title--chevron-back"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        {title}
    </div>
    <Chart {options} highcharts={Highcharts} />
</section>

<script lang="ts">
    import Highcharts from 'highcharts';
    import 'highcharts/modules/exporting';
    import { Chart } from '@highcharts/svelte'; // Chart is also exported by default

    let options = {
        chart: {
            type: 'line',
        },
        title: {
            text: 'Weather Forecast',
        },
    };

    import bcast from '@windy/broadcast';
    import { onDestroy, onMount } from 'svelte';

    import config from './pluginConfig';

    const { title } = config;

    import { fetchWeatherApi } from 'openmeteo';

    import { Variable } from '@openmeteo/sdk/variable';

    const params = {
        latitude: 34.928,
        longitude: -9.4,
        hourly: 'temperature_2m',
        forecast_days: 7,
        models: 'google_weathernext2_ensemble_mean',
    };
    const url = 'https://ensemble-api.open-meteo.com/v1/ensemble';
    const responses = fetchWeatherApi(url, params);

    responses.then(res => {
        // Process first location. Add a for-loop for multiple locations or weather models
        const response = res[0];
        console.log('QMS', response);

        // Attributes for timezone and location
        const latitude = response.latitude();
        const longitude = response.longitude();
        const elevation = response.elevation();
        const utcOffsetSeconds = response.utcOffsetSeconds();

        console.log(
            'QMS',
            `\nCoordinates: ${latitude}°N ${longitude}°E`,
            `\nElevation: ${elevation}m asl`,
            `\nTimezone difference to GMT+0: ${utcOffsetSeconds}s`,
            `\nTimezone: ${response.timezone()}`,
            `\nTimezone (short): ${response.timezoneAbbreviation()}`,
            `\nID: ${response.locationId()}`,
        );

        const hourly = response.hourly()!;
        const hourlyVariables = Array.from({ length: hourly.variablesLength() }, (_, i) =>
            hourly.variables(i),
        );
        const hourlyTemperature2m = hourlyVariables.filter(
            v => v?.variable() === Variable.temperature && v?.altitude() === 2,
        );

        // Note: The order of weather variables in the URL query and the indices below need to match!
        const weatherData = {
            hourly: {
                time: Array.from(
                    {
                        length:
                            (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval(),
                    },
                    (_, i) =>
                        new Date(
                            (Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) *
                                1000,
                        ),
                ),
            },
        };

        // Process all members
        for (const variable of hourlyTemperature2m) {
            const member = variable?.ensembleMember();
            weatherData.hourly[`temperature_2m_member${member}`] = variable!.valuesArray()!;
        }

        // The 'weatherData' object now contains a simple structure, with arrays of datetimes and weather information
        console.log('QMS\nHourly data:\n', weatherData.hourly);
        updateChart(weatherData.hourly.time, weatherData.hourly['temperature_2m_member0']);
    });

    function updateChart(time: Array<Date>, values: Float32Array) {
        options = {
            ...options,
            xAxis: {
                type: 'datetime',
                title: { text: 'Date' },
            },
            yAxis: {
                title: { text: 'ºC' },
            },
            series: [
                {
                    name: 'temperature_2m',
                    data: Array.from(values).map((value, index) => [time[index].getTime(), value]),
                },
            ],
        };
    }

    export const onopen = (_params: unknown) => {
        // Your plugin was opened with parameters parsed from URL
        // or with LatLon object if opened from contextmenu
    };

    onMount(() => {
        // Your plugin was mounted
    });

    onDestroy(() => {
        // Your plugin was destroyed
    });
</script>

<style lang="less">
    // Put any LESS of CSS styles here
</style>
