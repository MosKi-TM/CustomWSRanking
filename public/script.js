function createRankingEntryWithDataV(rankingsContainer, {
  rank,
  name,
  countryCode,
  countryName,
  profileUrl,
  previousRank,
  events,
  best,
  points
}) {
  if (!rankingsContainer) return;

  const flagSrc = `./World Sailing - Match Racing_files/${countryCode}.svg`;

  const dataV1 = 'data-v-6c67bdb9';
  const dataV2 = 'data-v-d8d86ada';

  const html = `
  <div ${dataV1} ${dataV2} class="ranking bg-tertiarytint mb-0-75 tf-body-bold">
    <div ${dataV1} class="ranking__display">
      <div ${dataV1} class="ranking__position ranking__field">
        <span ${dataV1} class="ranking__rank">${rank}</span>
      </div>
      <div ${dataV1} class="ranking__name ranking__field">
        <a ${dataV1} href="${profileUrl}" class="c-primary hover-c-secondary" title="${name}">
          ${name}
        </a>
      </div>
      <div ${dataV1} class="ranking__country ranking__field">
        <img ${dataV1} src="${flagSrc}" alt="Flag of ${countryName}" title="Flag of ${countryName}" class="ranking__flag mr-0-5">
        ${countryCode}
      </div>
      <div ${dataV1} class="ranking__crew ranking__field"></div>
      <div ${dataV1} class="ranking__events ranking__field">${events}</div>
      <div ${dataV1} class="ranking__best p-relative ranking__field">${best ? `<span ${dataV1}>${best}</span>` : ''}</div>
      <div ${dataV1} class="ranking__points ranking__field clickable">
        <span ${dataV1}>${points}</span>
        <i ${dataV1} class="icon-chevron-right"></i>
      </div>
    </div>
  </div>
  `;

  rankingsContainer.insertAdjacentHTML('beforeend', html);
}

function createRankingEntryWithDataVMobile(rankingsContainer, {
  rank,
  name,
  countryCode,
  countryName,
  profileUrl,
  previousRank,
  events,
  best,
  points
}) {
  if (!rankingsContainer) return;

  const flagSrc = `./World Sailing - Match Racing_files/${countryCode}.svg`;

  const dataV1 = 'data-v-6c67bdb9';
  const dataV2 = 'data-v-d8d86ada';

  const html = `
      <div data-v-738c3a56="" data-v-d8d86ada="" class="ranking mb-0-75 tf-body-bold"><div data-v-738c3a56="" class="ranking__display bg-tertiarytint pr-1-5"><div data-v-738c3a56="" class="ranking__position ranking__field"><span data-v-738c3a56="" class="ranking__field-title tf-body tf-light">
      Position
      </span> <span data-v-738c3a56="" class="ranking__position-info"><span data-v-738c3a56="" class="ranking__rank">
      ${rank}</span>
    </div>
    <div data-v-738c3a56="" class="ranking__name ranking__field">
      <span data-v-738c3a56="" class="ranking__field-title tf-body tf-light">
      Name
      </span> 
      <span data-v-738c3a56="" class="ranking__name-info">
          <a data-v-738c3a56="" href="https://www.sailing.org/sailor/christopher-poole?ref=USACP77" class="c-primary hover-c-secondary" title="${name}">
          ${name}
          </a> <!---->
      </span>
    </div>
    <div data-v-738c3a56="" class="ranking__toggle central"><button data-v-738c3a56="" class="c-primary central"><i data-v-738c3a56="" class="icon-plus"></i></button></div>
    </div> <!----> <!----></div>
  `;

  rankingsContainer.insertAdjacentHTML('beforeend', html);
}
  

document.addEventListener("DOMContentLoaded", () => {
    fetch("/api/ranking")
      .then(res => res.json())
      .then(data => {
        console.log(data)
        const containerWindows = document.querySelector('#app > section > div > section > div > div.rankings__rankings-table > div.rankings__rankings.p-relative > span:nth-child(1)');
        containerWindows.innerHTML = "";

        const containerMobile = document.querySelector('#app > section > div > section > div > div.rankings__rankings-table > div.rankings__rankings.p-relative > span:nth-child(2)');
        containerMobile.innerHTML = "";
  
        data.forEach(sailor => {
            createRankingEntryWithDataV(containerWindows, sailor)
            createRankingEntryWithDataVMobile(containerMobile, sailor)
        });
      })
      .catch(err => console.error("Failed to load ranking data:", err));
  });
  