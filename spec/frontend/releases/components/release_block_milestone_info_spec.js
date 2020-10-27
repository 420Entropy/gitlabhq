import { mount } from '@vue/test-utils';
import { GlProgressBar, GlLink, GlBadge, GlButton } from '@gitlab/ui';
import { trimText } from 'helpers/text_helper';
import { getJSONFixture } from 'helpers/fixtures';
import ReleaseBlockMilestoneInfo from '~/releases/components/release_block_milestone_info.vue';
import { MAX_MILESTONES_TO_DISPLAY } from '~/releases/constants';
import { convertObjectPropsToCamelCase } from '~/lib/utils/common_utils';

const { milestones: originalMilestones } = getJSONFixture('api/releases/release.json');

describe('Release block milestone info', () => {
  let wrapper;
  let milestones;

  const factory = props => {
    wrapper = mount(ReleaseBlockMilestoneInfo, {
      propsData: props,
    });

    return wrapper.vm.$nextTick();
  };

  beforeEach(() => {
    milestones = convertObjectPropsToCamelCase(originalMilestones, { deep: true });
  });

  afterEach(() => {
    wrapper.destroy();
    wrapper = null;
  });

  const milestoneProgressBarContainer = () => wrapper.find('.js-milestone-progress-bar-container');
  const milestoneListContainer = () => wrapper.find('.js-milestone-list-container');
  const issuesContainer = () => wrapper.find('.js-issues-container');

  describe('with default props', () => {
    beforeEach(() => factory({ milestones }));

    it('renders the correct percentage', () => {
      expect(milestoneProgressBarContainer().text()).toContain('44% complete');
    });

    it('renders a progress bar that displays the correct percentage', () => {
      const progressBar = milestoneProgressBarContainer().find(GlProgressBar);

      expect(progressBar.exists()).toBe(true);
      expect(progressBar.attributes()).toEqual(
        expect.objectContaining({
          value: '4',
          max: '9',
        }),
      );
    });

    it('renders a list of links to all associated milestones', () => {
      // The API currently returns the milestones in a non-deterministic order,
      // which causes the frontend fixture used by this test to return the
      // milestones in one order locally and a different order in the CI pipeline.
      // This is a bug and is tracked here: https://gitlab.com/gitlab-org/gitlab/-/issues/259012
      // When this bug is fixed this expectation should be updated to
      // assert the expected order.
      const containerText = trimText(milestoneListContainer().text());
      expect(
        containerText.includes('Milestones 12.4 • 12.3') ||
          containerText.includes('Milestones 12.3 • 12.4'),
      ).toBe(true);

      milestones.forEach((m, i) => {
        const milestoneLink = milestoneListContainer()
          .findAll(GlLink)
          .at(i);

        expect(milestoneLink.text()).toBe(m.title);
        expect(milestoneLink.attributes('href')).toBe(m.webUrl);
        expect(milestoneLink.attributes('title')).toBe(m.description);
      });
    });

    it('renders the "Issues" section with a total count of issues associated to the milestone(s)', () => {
      const totalIssueCount = 9;
      const issuesContainerText = trimText(issuesContainer().text());

      expect(issuesContainerText).toContain(`Issues ${totalIssueCount}`);

      const badge = issuesContainer().find(GlBadge);
      expect(badge.text()).toBe(totalIssueCount.toString());

      expect(issuesContainerText).toContain('Open: 5 • Closed: 4');
    });
  });

  describe('with lots of milestones', () => {
    let lotsOfMilestones;
    let fullListString;
    let abbreviatedListString;

    beforeEach(() => {
      lotsOfMilestones = [];
      const template = milestones[0];

      for (let i = 0; i < MAX_MILESTONES_TO_DISPLAY + 10; i += 1) {
        lotsOfMilestones.push({
          ...template,
          id: template.id + i,
          iid: template.iid + i,
          title: `m-${i}`,
        });
      }

      fullListString = lotsOfMilestones.map(m => m.title).join(' • ');
      abbreviatedListString = lotsOfMilestones
        .slice(0, MAX_MILESTONES_TO_DISPLAY)
        .map(m => m.title)
        .join(' • ');

      return factory({ milestones: lotsOfMilestones });
    });

    const clickShowMoreFewerButton = () => {
      milestoneListContainer()
        .find(GlButton)
        .trigger('click');

      return wrapper.vm.$nextTick();
    };

    const milestoneListText = () => trimText(milestoneListContainer().text());

    it('only renders a subset of the milestones', () => {
      expect(milestoneListText()).toContain(`Milestones ${abbreviatedListString} • show 10 more`);
    });

    it('renders all milestones when "show more" is clicked', () =>
      clickShowMoreFewerButton().then(() => {
        expect(milestoneListText()).toContain(`Milestones ${fullListString} • show fewer`);
      }));

    it('returns to the original view when "show fewer" is clicked', () =>
      clickShowMoreFewerButton()
        .then(clickShowMoreFewerButton)
        .then(() => {
          expect(milestoneListText()).toContain(
            `Milestones ${abbreviatedListString} • show 10 more`,
          );
        }));
  });

  const expectAllZeros = () => {
    it('displays percentage as 0%', () => {
      expect(milestoneProgressBarContainer().text()).toContain('0% complete');
    });

    it('shows 0 for all issue counts', () => {
      const issuesContainerText = trimText(issuesContainer().text());

      expect(issuesContainerText).toContain('Issues 0 Open: 0 • Closed: 0');
    });
  };

  /** Ensures we don't have any issues with dividing by zero when computing percentages */
  describe('when all issue counts are zero', () => {
    beforeEach(() => {
      milestones = milestones.map(m => ({
        ...m,
        issueStats: {
          ...m.issueStats,
          total: 0,
          closed: 0,
        },
      }));

      return factory({ milestones });
    });

    expectAllZeros();
  });

  describe('if the API response is missing the "issue_stats" property', () => {
    beforeEach(() => {
      milestones = milestones.map(m => ({
        ...m,
        issueStats: undefined,
      }));

      return factory({ milestones });
    });

    expectAllZeros();
  });
});
