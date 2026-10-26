<script lang="ts">
	import DoorScreen from '#lib/screens/DoorScreen.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<DoorScreen family="block" {data} />
