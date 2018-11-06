import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { translate } from 'react-i18next';
import { noop, Button, ButtonGroup, Grid, Icon, Radio, Alert } from 'patternfly-react';
import { connect, reduxActions } from '../../../redux';
import Breadcrumb from '../../../components/breadcrumb/breadcrumb';
import LoadingScreen from '../../../components/loadingScreen/loadingScreen';
import ErrorScreen from '../../../components/errorScreen/errorScreen';
import PfMasthead from '../../../components/masthead/masthead';
import WalkthroughResources from '../../../components/walkthroughResources/walkthroughResources';
import { prepareWalkthroughNamespace, walkthroughs, WALKTHROUGH_IDS } from '../../../services/walkthroughServices';
import { buildNamespacedServiceInstanceName } from '../../../common/openshiftHelpers';
import { getDocsForWalkthrough } from '../../../common/docsHelpers';
import { retrieveOverviewFromAdoc } from '../../../common/walkthroughHelpers';

class TaskPage extends React.Component {
  state = { task: 0, verifications: {} };

  componentDidMount() {
    const {
      getWalkthrough,
      match: {
        params: { id }
      }
    } = this.props;
    getWalkthrough(id);
    const { prepareWalkthroughOne, prepareWalkthroughOneA, prepareWalkthroughTwo } = this.props;
    if (this.props.match.params.id === WALKTHROUGH_IDS.ONE) {
      prepareWalkthroughOne(this.props.middlewareServices.amqCredentials);
    }
    if (this.props.match.params.id === WALKTHROUGH_IDS.ONE_A) {
      prepareWalkthroughOneA(this.props.middlewareServices.enmasseCredentials);
    }
    if (this.props.match.params.id === WALKTHROUGH_IDS.TWO) {
      prepareWalkthroughTwo();
    }
    const currentProgress = this.getStoredProgressForCurrentTask();
    if (currentProgress) {
      this.setState({ verifications: currentProgress });
    }
  }

  getStoredProgressForCurrentTask = () => {
    const {
      match: {
        params: { id, task }
      }
    } = this.props;
    const currentUsername = window.localStorage.getItem('currentUserName');
    const currentProgress = JSON.parse(localStorage.getItem(`walkthroughProgress_${currentUsername}`));
    if (!currentProgress || !currentProgress[id] || !currentProgress[id][task]) {
      return {};
    }
    return currentProgress[id][task];
  };

  updateStoredProgressForCurrentTask = verificationState => {
    const {
      match: {
        params: { id, task }
      }
    } = this.props;
    const currentUsername = window.localStorage.getItem('currentUserName');
    const oldProgressJSON = localStorage.getItem(`walkthroughProgress_${currentUsername}`);
    const oldProgress = JSON.parse(oldProgressJSON) || {};
    if (!oldProgress[id]) {
      oldProgress[id] = {};
    }
    if (!oldProgress[id][task]) {
      oldProgress[id][task] = {};
    }
    oldProgress[id][task] = verificationState;

    localStorage.setItem(`walkthroughProgress_${currentUsername}`, JSON.stringify(oldProgress));
  };

  getVerificationsForTask = task => {
    const stepVerifications = task.steps.map(step => this.getVerificationsForStep(step));
    // Flatten the array of arrays. Array.prototype.flat() is not IE/Edge compatible. (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat#Browser_compatibility)
    return [].concat(...stepVerifications);
  };

  getVerificationsForStep = step => step.blocks.filter(block => block.isVerification);

  getTotalSteps = tasks => {
    let totalSteps = 0;
    tasks.forEach(task => {
      task.steps.forEach(step => {
        if (step.infoVerifications) {
          totalSteps++;
        }
      });
    });
    return totalSteps;
  };

  docsAttributesProgress = attrs => {
    let found = 0;
    const requirements = {
      '1': ['spring-boot-url', 'node-js-url'],
      '1A': ['spring-boot-url', 'node-js-url']
    };
    if (!(attrs['walkthrough-id'] in requirements)) {
      return 100;
    }
    for (let i = 0; i < requirements[attrs['walkthrough-id']].length; i++) {
      if (attrs[requirements[attrs['walkthrough-id']][i]] !== null) {
        found++;
      }
    }
    if (found === requirements[attrs['walkthrough-id']].length) {
      return 100;
    }
    if (found === 0) {
      return 0;
    }
    return 100 * (found / requirements[attrs['walkthrough-id']].length);
  };

  // Temporary fix for the Asciidoc renderer not being reactive.
  getDocsAttributes = () => {
    const walkthrough = Object.values(walkthroughs).find(w => w.id === this.props.match.params.id);
    return getDocsForWalkthrough(walkthrough, this.props.middlewareServices, this.props.walkthroughServices);
  };

  getAMQCredential = (middlewareServices, name) => {
    if (!middlewareServices || !middlewareServices.amqCredentials || !middlewareServices.amqCredentials[name]) {
      return null;
    }
    return middlewareServices.amqCredentials[name];
  };

  getUrlFromWalkthroughServices = (walkthroughServices, serviceName) => {
    if (
      !walkthroughServices ||
      !walkthroughServices.services ||
      !walkthroughServices.services[buildNamespacedServiceInstanceName(walkthroughs.one.namespaceSuffix, serviceName)]
    ) {
      return null;
    }
    return walkthroughServices.services[serviceName].spec.host;
  };

  backToIntro = e => {
    e.preventDefault();
    const {
      history,
      match: {
        params: { id }
      }
    } = this.props;
    history.push(`/tutorial/${id}`);
  };

  goToTask = (e, next) => {
    e.preventDefault();
    const {
      history,
      match: {
        params: { id }
      }
    } = this.props;
    history.push(`/tutorial/${id}/task/${next}`);
  };

  exitTutorial = e => {
    e.preventDefault();
    const { history } = this.props;
    history.push(`/congratulations/${this.props.thread.data.id}`);
  };

  handleVerificationInput = (e, verification, isSuccess) => {
    const o = Object.assign({}, this.state.verifications);
    o[verification.verificationId] = isSuccess;
    this.setState({ verifications: o }, () => {
      this.updateStoredProgressForCurrentTask(this.state.verifications);
    });
  };

  taskVerificationStatus = (verifications, toVerify) => {
    if (toVerify.length === 0) {
      return true;
    }
    for (const verification of toVerify) {
      if (!verifications[verification.verificationId]) {
        return false;
      }
    }
    return true;
  };

  renderVerificationBlock(id, block) {
    const { t } = this.props;
    let isFalseChecked = null;
    if (this.state.verifications[block.verificationId] !== undefined) {
      isFalseChecked = !this.state.verifications[block.verificationId];
    }
    return (
      <Alert type="info" className="integr8ly-module-column--steps_alert-blue" key={id}>
        <strong>{t('task.verificationTitle')}</strong>
        <div dangerouslySetInnerHTML={{ __html: block.bodyHTML }} />
        {
          <React.Fragment>
            <Radio
              name={id}
              checked={!!this.state.verifications[block.verificationId]}
              onChange={e => {
                this.handleVerificationInput(e, block, true);
              }}
            >
              Yes
            </Radio>
            <Radio
              name={id}
              checked={isFalseChecked}
              onChange={e => {
                this.handleVerificationInput(e, block, false);
              }}
            >
              No
            </Radio>
            {this.state.verifications[block.verificationId] !== undefined &&
              !this.state.verifications[block.verificationId] &&
              block.verificationFailText}
          </React.Fragment>
        }
      </Alert>
    );
  }

  render() {
    const attrs = this.getDocsAttributes();
    const { t, thread } = this.props;
    const { verifications } = this.state;
    
    console.log('PROPS', this.props);
    if (thread.pending) {
      // todo: loading state
      return null;
    }

    if (thread.error) {
      return (
        <div>
          <PfMasthead />
          <ErrorScreen />
        </div>
      );
    }

    if (thread.fulfilled && thread.data) {
      const {
        match: {
          params: { id, task }
        }
      } = this.props;
      const taskNum = parseInt(task, 10);
      const parsedThread = retrieveOverviewFromAdoc(thread.data);
      const threadTask = parsedThread.tasks[taskNum];
      const totalTasks = parsedThread.tasks.filter(parsedTask => !parsedTask.isVerification).length;
      const loadingText = `We're initiating services for " ${parsedThread.title} ".`;
      const standbyText = ' Please stand by.';
      const taskVerificationComplete = this.taskVerificationStatus(
        this.state.verifications,
        this.getVerificationsForTask(threadTask)
      );
      return (
        <React.Fragment>
          <Breadcrumb
            threadName={parsedThread.title}
            threadId={id}
            taskPosition={taskNum + 1}
            totalTasks={totalTasks}
            homeClickedCallback={() => {}}
          />
          <Grid fluid>
            <LoadingScreen
              loadingText={loadingText}
              standbyText={standbyText}
              progress={!window.OPENSHIFT_CONFIG.mockData ? this.docsAttributesProgress(attrs) : 100}
            />
            <Grid.Row>
              <Grid.Col xs={12} sm={9} className="integr8ly-module">
                <div className="integr8ly-module-column">
                  <div className="integr8ly-module-column--steps">
                    {threadTask.steps.map((step, i) => (
                      <React.Fragment key={i}>
                        <h3>{step.title}</h3>
                        {step.blocks.map((block, j) => (
                          <React.Fragment key={`${i}-${j}`}>
                            {!block.isVerification && <div dangerouslySetInnerHTML={{ __html: block.bodyHTML }} />}
                            {block.isVerification && this.renderVerificationBlock(`${i}-${j}`, block)}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Bottom footer */}
                  <div className="integr8ly-module-column--footer">
                    <h6>{t('task.CompleteAndCheck')}</h6>
                    <div className="integr8ly-module-column--footer_status">
                      {threadTask.steps.map((step, l) => (
                        <React.Fragment key={l}>
                          {/* Bottom footer icon */}
                          {step.infoVerifications &&
                            step.infoVerifications.map(
                              (verification, v) =>
                                verifications[step.infoVerifications[0]] === undefined ? (
                                  <Icon
                                    type="fa"
                                    className="far integr8ly-module-column--footer_status"
                                    key={v}
                                    name="circle"
                                  />
                                ) : (
                                  <Icon
                                    type="fa"
                                    className={
                                      step.infoVerifications && verifications[step.infoVerifications[0]]
                                        ? 'far integr8ly-module-column--footer_status-checked'
                                        : 'far integr8ly-module-column--footer_status-unchecked'
                                    }
                                    key={v}
                                    name={verifications[step.infoVerifications[0]] ? 'check-circle' : 'times-circle'}
                                  />
                                )
                            )}
                          {/* Bottom footer number to the right of icon  */}
                          {step.infoVerifications &&
                            step.infoVerifications.map(
                              (verification, v) =>
                                verifications[step.infoVerifications[0]] === undefined ? (
                                  <span className="integr8ly-module-column--footer_status" key={v}>
                                    {task + 1}.{l + 1}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      verifications[step.infoVerifications[0]]
                                        ? 'integr8ly-module-column--footer_status-checked'
                                        : 'integr8ly-module-column--footer_status-unchecked'
                                    }
                                    key={v}
                                  >
                                    {task + 1}.{l + 1}
                                  </span>
                                )
                            )}
                        </React.Fragment>
                      ))}
                    </div>

                    <div
                      className="btn-group btn-group-justified"
                      role="group"
                      aria-label="module step progress buttons"
                    >
                      {taskNum === 0 && (
                        <ButtonGroup>
                          <Button onClick={e => this.backToIntro(e)}>
                            <Icon type="fa" name="angle-left" style={{ paddingRight: 5 }} />
                            {t('task.backToIntro')}
                          </Button>
                        </ButtonGroup>
                      )}
                      {taskNum > 0 && (
                        <ButtonGroup>
                          <Button onClick={e => this.goToTask(e, taskNum - 1)}>
                            <Icon type="fa" name="angle-left" style={{ paddingRight: 5 }} />
                            {t('task.previousTask')}
                          </Button>
                        </ButtonGroup>
                      )}
                      {taskNum + 1 < totalTasks && (
                        <ButtonGroup>
                          <Button
                            bsStyle={taskVerificationComplete ? 'primary' : 'default'}
                            onClick={e => this.goToTask(e, taskNum + 1)}
                            disabled={!taskVerificationComplete}
                          >
                            {t('task.nextTask')} <Icon type="fa" name="angle-right" style={{ paddingLeft: 5 }} />
                          </Button>
                        </ButtonGroup>
                      )}
                      {taskNum + 1 === totalTasks && (
                        <ButtonGroup>
                          <Button
                            bsStyle={taskVerificationComplete ? 'primary' : 'default'}
                            onClick={e => this.exitTutorial(e)}
                            disabled={!taskVerificationComplete}
                          >
                            {t('task.exitTutorial')} <Icon type="fa" name="angle-right" style={{ paddingLeft: 5 }} />
                          </Button>
                        </ButtonGroup>
                      )}
                    </div>
                  </div>
                </div>
              </Grid.Col>
              <Grid.Col sm={3} className="integr8ly-module-frame">
                {/* <h4 className="integr8ly-helpful-links-heading">Walkthrough Diagram</h4>
                <img src="/images/st0.png" className="img-responsive" alt="integration" /> */}
                <WalkthroughResources resources={thread.data.resources} />
              </Grid.Col>
            </Grid.Row>
          </Grid>
        </React.Fragment>
      );
    }
    return null;
  }
}

TaskPage.propTypes = {
  // i18n: PropTypes.object,
  t: PropTypes.func.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }),
  match: PropTypes.shape({
    params: PropTypes.object
  }),
  middlewareServices: PropTypes.object,
  walkthroughServices: PropTypes.object,
  prepareWalkthroughOne: PropTypes.func,
  prepareWalkthroughOneA: PropTypes.func,
  prepareWalkthroughTwo: PropTypes.func,
  thread: PropTypes.object,
  //user: PropTypes.object,
  getWalkthrough: PropTypes.func
};

TaskPage.defaultProps = {
  // i18n: {
  //   language: 'en'
  // },
  history: {
    push: noop
  },
  match: {
    params: {}
  },
  middlewareServices: {
    data: {},
    amqCredentials: {},
    enmasseCredentials: {}
  },
  walkthroughServices: {
    services: {}
  },
  prepareWalkthroughOne: noop,
  prepareWalkthroughOneA: noop,
  prepareWalkthroughTwo: noop,
  thread: null,
  //user: null,
  getWalkthrough: noop
};

const mapDispatchToProps = dispatch => ({
  getThread: (language, id) => dispatch(reduxActions.threadActions.getThread(language, id)),
  prepareWalkthroughOne: amqCredentials => prepareWalkthroughNamespace(dispatch, walkthroughs.one, amqCredentials),
  prepareWalkthroughOneA: enmasseCredentials =>
    prepareWalkthroughNamespace(dispatch, walkthroughs.oneA, enmasseCredentials),
  getProgress: progress => dispatch(reduxActions.userActions.getProgress()),
  prepareWalkthroughTwo: () => prepareWalkthroughNamespace(dispatch, walkthroughs.two, null),
  setProgress: progress => dispatch(reduxActions.userActions.setProgress(progress)),
  getWalkthrough: id => dispatch(reduxActions.threadActions.getCustomThread(id))
});

const mapStateToProps = state => ({
  ...state.threadReducers,
  ...state.middlewareReducers,
  ...state.userReducers,
  ...state.walkthroughServiceReducers
});

const ConnectedTaskPage = withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(translate()(TaskPage))
);

export { ConnectedTaskPage as default, ConnectedTaskPage, TaskPage };
